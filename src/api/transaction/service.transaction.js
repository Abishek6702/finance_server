const StudentTransaction = require("./model.studentTransaction");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");
const AppError = require("../../utils/AppError");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partially Paid";
  else target.status = "Unpaid";
};

const recordPayment = async (data) => {
  const { rollNo, receiptNo, paymentType, bankName, bankLocation, remarks, breakdowns } = data;

  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  /* ===================================================================
     STEP 1: VALIDATE ALL PAYMENT AMOUNTS BEFORE PROCESSING
     - No component should exceed its remaining due
     - Total payment must be > 0
     - Transaction is created ONLY if all validations pass
  =================================================================== */

  let grandTotal = 0;

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) throw new AppError(`Academic year ${bd.academicYear} not found in fee tracking`, 404);

    // Validate academic fee components
    if (bd.academic && bd.academic.semesterNumber) {
      const sem = bd.academic.semesterNumber % 2 === 1 ? yearRecord.academic?.odd : yearRecord.academic?.even;
      if (!sem) throw new AppError(`Semester ${bd.academic.semesterNumber} not found in tracking for ${bd.academicYear}`, 404);

      const fields = ['tuition', 'exam', 'erp', 'book', 'lab'];
      for (const field of fields) {
        const payAmount = normalizeMoney(bd.academic[field] || 0);
        if (payAmount > 0) {
          const total = normalizeMoney(sem[field]?.total || 0);
          const paid = normalizeMoney(sem[field]?.paid || 0);
          const remaining = normalizeMoney(total - paid);
          if (payAmount > remaining) {
            throw new AppError(
              `${field} payment ₹${payAmount} exceeds remaining due ₹${remaining} for semester ${bd.academic.semesterNumber} in ${bd.academicYear}`, 400
            );
          }
          grandTotal += payAmount;
        }
      }
    }

    // Validate hostel payment
    if (bd.hostel && normalizeMoney(bd.hostel) > 0) {
      if (!yearRecord.hostel) throw new AppError(`No hostel fee record found for ${bd.academicYear}`, 404);
      const hostelRemaining = normalizeMoney(
        (yearRecord.hostel.total?.total || 0) - (yearRecord.hostel.total?.paid || 0)
      );
      if (normalizeMoney(bd.hostel) > hostelRemaining) {
        throw new AppError(
          `Hostel payment ₹${bd.hostel} exceeds remaining due ₹${hostelRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.hostel);
    }

    // Validate transport payment
    if (bd.transport && normalizeMoney(bd.transport) > 0) {
      if (!yearRecord.transport) throw new AppError(`No transport fee record found for ${bd.academicYear}`, 404);
      const transportRemaining = normalizeMoney(
        (yearRecord.transport.total?.total || 0) - (yearRecord.transport.total?.paid || 0)
      );
      if (normalizeMoney(bd.transport) > transportRemaining) {
        throw new AppError(
          `Transport payment ₹${bd.transport} exceeds remaining due ₹${transportRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.transport);
    }
  }

  // Reject zero-amount payments
  if (grandTotal <= 0) {
    throw new AppError("Total payment amount must be greater than 0", 400);
  }

  /* ===================================================================
     STEP 2: ALL VALIDATIONS PASSED – Create transaction record
  =================================================================== */

  let transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    const student = await Student.findOne({ "personal.rollNo": rollNo });
    if (!student) throw new AppError("Student not found", 404);
    transactionDoc = new StudentTransaction({
      student: student._id,
      rollNo,
      transactions: []
    });
  }

  const mappedBreakdowns = breakdowns.map(bd => {
    const academic = bd.academic || {};
    let academicTotal = 0;
    academicTotal += normalizeMoney(academic.tuition || 0)
      + normalizeMoney(academic.exam || 0)
      + normalizeMoney(academic.erp || 0)
      + normalizeMoney(academic.book || 0)
      + normalizeMoney(academic.lab || 0);

    const total = normalizeMoney(academicTotal + normalizeMoney(bd.hostel || 0) + normalizeMoney(bd.transport || 0));

    return {
      academicYear: bd.academicYear,
      academic: {
        semesterNumber: academic.semesterNumber,
        tuition: normalizeMoney(academic.tuition || 0),
        exam: normalizeMoney(academic.exam || 0),
        erp: normalizeMoney(academic.erp || 0),
        book: normalizeMoney(academic.book || 0),
        lab: normalizeMoney(academic.lab || 0)
      },
      hostel: normalizeMoney(bd.hostel || 0),
      transport: normalizeMoney(bd.transport || 0),
      total
    };
  });

  transactionDoc.transactions.push({
    receiptNo,
    paymentType,
    bankName,
    bankLocation,
    remarks,
    breakdowns: mappedBreakdowns
  });

  await transactionDoc.save();

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) continue;

    const addPayment = (target, amount) => {
      if (!target || !amount) return;

      const increment = normalizeMoney(amount);
      target.total = normalizeMoney(target.total || 0);
      target.paid = normalizeMoney((target.paid || 0) + increment);
      target.paid = Math.min(target.paid, target.total);
      setStatus(target);
    };

    if (bd.academic && bd.academic.semesterNumber) {
      const sem = bd.academic.semesterNumber % 2 === 1 ? yearRecord.academic.odd : yearRecord.academic.even;
      if (sem) {
        addPayment(sem.tuition, bd.academic.tuition);
        addPayment(sem.exam, bd.academic.exam);
        addPayment(sem.erp, bd.academic.erp);
        addPayment(sem.book, bd.academic.book);
        addPayment(sem.lab, bd.academic.lab);

        const semPaid = normalizeMoney((sem.tuition?.paid || 0) + (sem.exam?.paid || 0) + (sem.erp?.paid || 0) + (sem.book?.paid || 0) + (sem.lab?.paid || 0));
        sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
        setStatus(sem.total);
      }

      const termTotalPaid = normalizeMoney((yearRecord.academic.odd?.total?.paid || 0) + (yearRecord.academic.even?.total?.paid || 0));
      yearRecord.academic.total.paid = Math.min(termTotalPaid, normalizeMoney(yearRecord.academic.total.total || 0));
      setStatus(yearRecord.academic.total);
    }

    if (bd.hostel && yearRecord.hostel) {
      addPayment(yearRecord.hostel.total, bd.hostel);
    }
    if (bd.transport && yearRecord.transport) {
      addPayment(yearRecord.transport.total, bd.transport);
    }

    const yearPaid = normalizeMoney((yearRecord.academic.total?.paid || 0) + (yearRecord.hostel?.total?.paid || 0) + (yearRecord.transport?.total?.paid || 0));
    yearRecord.total.paid = Math.min(yearPaid, normalizeMoney(yearRecord.total.total || 0));
    setStatus(yearRecord.total);
  }

  tracking.markModified("academicYearWiseRecord");
  await tracking.save();

  return transactionDoc;
};

const getStudentTransactions = async (rollNo) => {
  const transactionDoc = await StudentTransaction.findOne({ rollNo }).populate("student");
  if (!transactionDoc) throw new AppError("Transactions not found for this student", 404);
  return transactionDoc;
};

const getRecentPayments = async (query = {}) => {
  const pipeline = [
    { $unwind: "$transactions" },
    { $sort: { "transactions.paidOn": -1 } },
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData"
      }
    },
    { $unwind: "$studentData" }
  ];

  const matchFilters = {};
  if (query.year) {
    matchFilters["transactions.breakdowns.academicYear"] = query.year;
  }
  if (query.department) {
    matchFilters["studentData.academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, "i") };
  }
  if (query.paymentMode) {
    matchFilters["transactions.paymentType"] = { $regex: new RegExp(`^${query.paymentMode}$`, "i") };
  }
  if (query.name) {
    matchFilters["studentData.personal.studentName"] = { $regex: new RegExp(query.name, "i") };
  }
  if (query.rollNo) {
    matchFilters["rollNo"] = { $regex: new RegExp(`^${query.rollNo}$`, "i") };
  }
  if (query.feeHead) {
    const head = query.feeHead.toLowerCase();
    const feeHeadFilter = [];
    if (["tuition", "exam", "erp", "book", "lab"].includes(head)) {
      feeHeadFilter.push({ [`transactions.breakdowns.academic.${head}`]: { $gt: 0 } });
    }
    if (head === "hostel") feeHeadFilter.push({ "transactions.breakdowns.hostel": { $gt: 0 } });
    if (head === "transport") feeHeadFilter.push({ "transactions.breakdowns.transport": { $gt: 0 } });
    if (feeHeadFilter.length > 0) matchFilters["$or"] = feeHeadFilter;
  }
  if (query.fromDate && query.toDate) {
    matchFilters["transactions.paidOn"] = {
      $gte: new Date(query.fromDate),
      $lte: new Date(query.toDate)
    };
  } else if (query.fromDate) {
    matchFilters["transactions.paidOn"] = { $gte: new Date(query.fromDate) };
  } else if (query.toDate) {
    matchFilters["transactions.paidOn"] = { $lte: new Date(query.toDate) };
  }
  if (Object.keys(matchFilters).length > 0) {
    pipeline.push({ $match: matchFilters });
  }

  const limit = parseInt(query.limit) || 50;
  pipeline.push({ $limit: limit });

  pipeline.push({
    $project: {
      rollNo: 1,
      transaction: "$transactions",
      studentDetails: {
        name: "$studentData.personal.studentName",
        department: "$studentData.academic.departmentName",
        year: "$studentData.academic.yearStudying",
        photo: "$studentData.personal.studentPhoto"
      }
    }
  });

  return await StudentTransaction.aggregate(pipeline).exec();
};

/* ===================================================================
   REPORTS
=================================================================== */

/**
 * Individual student report — receipts with per-fee-head demand / paid / balance
 */
const getStudentReport = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo })
    .select("personal.rollNo personal.studentName academic.departmentName academic.yearStudying")
    .lean();
  if (!student) throw new AppError("Student not found", 404);

  const txDoc = await StudentTransaction.findOne({ rollNo }).lean();
  const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();

  const receipts = [];
  if (txDoc) {
    for (const tx of txDoc.transactions) {
      for (const bd of tx.breakdowns) {
        const yearRecord = tracking?.academicYearWiseRecord?.find(r => r.academicYear === bd.academicYear);
        const sem = bd.academic?.semesterNumber
          ? (bd.academic.semesterNumber % 2 === 1 ? yearRecord?.academic?.odd : yearRecord?.academic?.even)
          : null;

        const feeRows = [];
        const academicFields = ["tuition", "exam", "erp", "book", "lab"];
        for (const field of academicFields) {
          const paidAmt = normalizeMoney(bd.academic?.[field] || 0);
          if (paidAmt > 0 || (sem && (sem[field]?.total || 0) > 0)) {
            feeRows.push({
              feeHead: "Academic",
              subHead: field,
              demand: normalizeMoney(sem?.[field]?.total || 0),
              paid: paidAmt,
              balance: normalizeMoney((sem?.[field]?.total || 0) - (sem?.[field]?.paid || 0))
            });
          }
        }
        if (bd.hostel > 0 || (yearRecord?.hostel?.total?.total || 0) > 0) {
          feeRows.push({
            feeHead: "Hostel",
            subHead: "hostel",
            demand: normalizeMoney(yearRecord?.hostel?.total?.total || 0),
            paid: normalizeMoney(bd.hostel || 0),
            balance: normalizeMoney((yearRecord?.hostel?.total?.total || 0) - (yearRecord?.hostel?.total?.paid || 0))
          });
        }
        if (bd.transport > 0 || (yearRecord?.transport?.total?.total || 0) > 0) {
          feeRows.push({
            feeHead: "Transport",
            subHead: "transport",
            demand: normalizeMoney(yearRecord?.transport?.total?.total || 0),
            paid: normalizeMoney(bd.transport || 0),
            balance: normalizeMoney((yearRecord?.transport?.total?.total || 0) - (yearRecord?.transport?.total?.paid || 0))
          });
        }

        receipts.push({
          receiptNo: tx.receiptNo,
          academicYear: bd.academicYear,
          semesterNumber: bd.academic?.semesterNumber || null,
          semesterPeriod: bd.academic?.semesterNumber
            ? (bd.academic.semesterNumber % 2 === 1 ? "Odd" : "Even")
            : null,
          paymentDate: tx.paidOn,
          paymentMode: tx.paymentType,
          bankName: tx.bankName,
          totalAmount: normalizeMoney(bd.total || 0),
          feeBreakdown: feeRows
        });
      }
    }
  }

  return {
    student: {
      rollNo: student.personal?.rollNo,
      name: student.personal?.studentName,
      department: student.academic?.departmentName,
      year: student.academic?.yearStudying
    },
    receipts
  };
};

/**
 * Date-wise payment report — flattened rows sorted by date
 */
const getDatewiseReport = async (query = {}) => {
  const pipeline = [
    { $unwind: "$transactions" },
    { $sort: { "transactions.paidOn": -1 } },
    { $unwind: "$transactions.breakdowns" },
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData"
      }
    },
    { $unwind: "$studentData" }
  ];

  const matchFilters = {};
  if (query.academicYear) {
    matchFilters["transactions.breakdowns.academicYear"] = query.academicYear;
  }
  if (query.fromDate && query.toDate) {
    matchFilters["transactions.paidOn"] = {
      $gte: new Date(query.fromDate),
      $lte: new Date(query.toDate)
    };
  } else if (query.fromDate) {
    matchFilters["transactions.paidOn"] = { $gte: new Date(query.fromDate) };
  } else if (query.toDate) {
    matchFilters["transactions.paidOn"] = { $lte: new Date(query.toDate) };
  }
  if (Object.keys(matchFilters).length > 0) {
    pipeline.push({ $match: matchFilters });
  }

  const limit = parseInt(query.limit) || 100;
  pipeline.push({ $limit: limit });

  pipeline.push({
    $project: {
      rollNo: 1,
      studentName: "$studentData.personal.studentName",
      department: "$studentData.academic.departmentName",
      year: "$studentData.academic.yearStudying",
      academicYear: "$transactions.breakdowns.academicYear",
      semesterNumber: "$transactions.breakdowns.academic.semesterNumber",
      semesterPeriod: {
        $cond: {
          if: { $eq: [{ $mod: [{ $ifNull: ["$transactions.breakdowns.academic.semesterNumber", 0] }, 2] }, 1] },
          then: "Odd", else: "Even"
        }
      },
      feeHead: {
        tuition: "$transactions.breakdowns.academic.tuition",
        exam: "$transactions.breakdowns.academic.exam",
        erp: "$transactions.breakdowns.academic.erp",
        book: "$transactions.breakdowns.academic.book",
        lab: "$transactions.breakdowns.academic.lab",
        hostel: "$transactions.breakdowns.hostel",
        transport: "$transactions.breakdowns.transport"
      },
      amount: "$transactions.breakdowns.total",
      date: "$transactions.paidOn",
      paymentMode: "$transactions.paymentType",
      bankName: "$transactions.bankName",
      receiptNo: "$transactions.receiptNo"
    }
  });

  return await StudentTransaction.aggregate(pipeline).exec();
};

module.exports = {
  recordPayment,
  getStudentTransactions,
  getRecentPayments,
  getStudentReport,
  getDatewiseReport
};
