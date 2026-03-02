const StudentFeeTracking = require("./model.studentFeeTracking");
const StudentTransaction = require("../transaction/model.studentTransaction");
const Student = require("../students/model.student");
const ActivityLog = require("../../models/ActivityLog");
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

const createReceipt = async (data) => {
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

const getFeesSummary = async (query = {}) => {
  const year = query.year || "2025-2026";
  const filter = { "academicYearWiseRecord.academicYear": year };

  if (query.rollNo) {
    filter.rollNo = { $regex: new RegExp(`^${query.rollNo}$`, "i") };
  }

  const records = await StudentFeeTracking.find(filter)
    .populate({
      path: "student",
      select: "personal.studentName personal.studentPhoto personal.community academic.departmentName academic.yearStudying enrollment.quota transport.isApplicable hostel.isApplicable"
    })
    .lean();

  let totalCollection = 0;
  let totalDue = 0;

  const data = records.map(record => {
    const yearRecord = record.academicYearWiseRecord.find(r => r.academicYear === year);
    if (!yearRecord) return null;

    const demand = yearRecord.total?.total || 0;
    const paid = yearRecord.total?.paid || 0;
    const concession = yearRecord.concessions?.totalConcession || 0;
    const overdue = Math.max(0, demand - paid);
    const status = yearRecord.total?.status || "Unpaid";

    totalCollection += paid;
    totalDue += overdue;

    const studentInfo = record.student || {};
    const isHosteler = studentInfo.hostel?.isApplicable || false;
    const usesTransport = studentInfo.transport?.isApplicable || false;

    return {
      rollNo: record.rollNo,
      studentDetails: {
        name: studentInfo.personal?.studentName,
        department: studentInfo.academic?.departmentName,
        year: studentInfo.academic?.yearStudying,
        photo: studentInfo.personal?.studentPhoto
      },
      demand,
      concession,
      paid,
      overdue,
      status,
      studentType: {
        isHosteler,
        isDayScholar: !isHosteler,
        usesTransport
      },
      yearRecord
    };
  }).filter(Boolean);

  // Apply post-query filters
  let filtered = data;
  if (query.name) {
    const nameRe = new RegExp(query.name, "i");
    filtered = filtered.filter(r => nameRe.test(r.studentDetails.name));
  }
  if (query.department) {
    const deptRe = new RegExp(`^${query.department}$`, "i");
    filtered = filtered.filter(r => deptRe.test(r.studentDetails.department));
  }
  if (query.status) {
    const statusRe = new RegExp(`^${query.status}$`, "i");
    filtered = filtered.filter(r => statusRe.test(r.status));
  }
  if (query.studentType) {
    const st = query.studentType.toLowerCase();
    if (st === "hosteler") filtered = filtered.filter(r => r.studentType.isHosteler);
    else if (st === "dayscholar") filtered = filtered.filter(r => r.studentType.isDayScholar);
    else if (st === "transport") filtered = filtered.filter(r => r.studentType.usesTransport);
  }
  
  if (query.semesterNumber) {
     filtered = filtered.filter(r => {
        const oddSem = r.yearRecord?.academic?.odd?.semesterNumber;
        const evenSem = r.yearRecord?.academic?.even?.semesterNumber;
        return String(oddSem) === String(query.semesterNumber) || String(evenSem) === String(query.semesterNumber);
     });
  }

  const resultCount = filtered.length;
  
  // Pagination
  const page = query.page && query.page !== "all" ? parseInt(query.page) : 1;
  const limit = query.limit && query.limit !== "all" ? parseInt(query.limit) : resultCount > 0 ? resultCount : 50;
  const skip = (page - 1) * limit;
  
  let paginatedRecords = filtered;
  if (query.limit !== "all" && query.page !== "all") {
    paginatedRecords = filtered.slice(skip, skip + limit);
  } else if (query.limit !== "all") {
    paginatedRecords = filtered.slice(0, limit);
  }

  return {
    records: paginatedRecords,
    aggregate: {
      totalCollection: normalizeMoney(totalCollection),
      totalDue: normalizeMoney(totalDue)
    },
    pagination: {
      totalCount: resultCount,
      page: query.page === "all" ? 1 : page,
      limit: query.limit === "all" ? resultCount : limit,
      totalPages: query.limit === "all" ? 1 : Math.ceil(resultCount / limit),
      hasMore: query.limit === "all" ? false : skip + paginatedRecords.length < resultCount
    }
  };
};

const getStudentFeeSummary = async (rollNo) => {
  const record = await StudentFeeTracking.findOne({ rollNo })
    .populate("student")
    .lean();

  if (!record) throw new AppError("Fee tracking not found for this student", 404);

  let demandTotal = 0, concessionTotal = 0, paidTotal = 0, fineTotal = 0;

  const yearsSummary = record.academicYearWiseRecord.map(yearRecord => {
    const demand = yearRecord.total?.total || 0;
    const paid = yearRecord.total?.paid || 0;
    const concession = yearRecord.concessions?.totalConcession || 0;
    const overdue = Math.max(0, demand - paid);
    const status = yearRecord.total?.status || "Unpaid";

    demandTotal += demand;
    concessionTotal += concession;
    paidTotal += paid;

    const hasHostel = (yearRecord.hostel?.total?.total || 0) > 0;
    const hasTransport = (yearRecord.transport?.total?.total || 0) > 0;

    return {
      academicYear: yearRecord.academicYear,
      demand,
      concession,
      paid,
      overdue,
      status,
      fine: 0,
      studentType: {
        isHosteler: hasHostel,
        usesTransport: hasTransport,
        isDayScholar: !hasHostel
      },
      yearRecordDetails: yearRecord
    };
  });

  const overallOverdue = Math.max(0, demandTotal - paidTotal);
  const overallStatus = paidTotal >= demandTotal ? "Paid"
    : paidTotal > 0 ? "Partially Paid" : "Unpaid";

  const profile = record.student || {};

  return {
    studentProfile: profile,
    feeSummaryRecords: yearsSummary,
    overallTotals: {
      demand: normalizeMoney(demandTotal),
      concession: normalizeMoney(concessionTotal),
      paid: normalizeMoney(paidTotal),
      fine: normalizeMoney(fineTotal),
      overdue: normalizeMoney(overallOverdue),
      status: overallStatus
    }
  };
};

const getStudentsForFilter = async (query = {}) => {
  const search = {};

  if (query.department) {
    search["academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, "i") };
  }
  if (query.year) {
    search["academic.yearStudying"] = parseInt(query.year);
  }
  if (query.name) {
    search["personal.studentName"] = { $regex: new RegExp(query.name, "i") };
  }
  if (query.rollNo) {
    search["personal.rollNo"] = { $regex: new RegExp(query.rollNo, "i") };
  }

  const students = await Student.find(search)
    .select("personal.rollNo personal.studentName personal.studentPhoto academic.departmentName academic.yearStudying")
    .lean();

  return students.map(s => ({
    rollNo: s.personal?.rollNo,
    name: s.personal?.studentName,
    department: s.academic?.departmentName,
    year: s.academic?.yearStudying,
    photo: s.personal?.studentPhoto
  }));
};

const updateReceipt = async (receiptNo, data, user) => {
  const transactionDoc = await StudentTransaction.findOne({ "transactions.receiptNo": receiptNo });
  if (!transactionDoc) throw new AppError("Transaction not found", 404);

  const transactionIndex = transactionDoc.transactions.findIndex(t => t.receiptNo === receiptNo);
  if (transactionIndex === -1) throw new AppError("Transaction not found", 404);

  const oldTransaction = transactionDoc.transactions[transactionIndex];

  const allowedFields = ["paymentType", "bankName", "bankLocation", "remarks"];
  let hasChanges = false;
  const oldValue = {};
  const newValue = {};

  allowedFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== oldTransaction[field]) {
      oldValue[field] = oldTransaction[field];
      newValue[field] = data[field];
      transactionDoc.transactions[transactionIndex][field] = data[field];
      hasChanges = true;
    }
  });

  if (hasChanges) {
    await transactionDoc.save();

    await ActivityLog.create({
      user: user?._id || null,
      endpoint: `/api/studentFeeTracking/receipt/${receiptNo}`,
      method: "PUT",
      module: "Finance",
      description: `Updated receipt ${receiptNo}`,
      before: oldValue,
      after: newValue,
      meta: {
        email: user?.email || "admin",
        status: "Success"
      }
    });
  }

  return transactionDoc.transactions[transactionIndex];
};

const updateConcession = async (rollNo, academicYear, concessionData) => {
  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
  if (!yearRecord) throw new AppError("Academic year record not found", 404);

  const safeConcessions = {
    firstGraduate: normalizeMoney(concessionData?.firstGraduate || 0),
    scheme7point5: normalizeMoney(concessionData?.scheme7point5 || 0),
    pmss: normalizeMoney(concessionData?.pmss || 0),
    sakthi: normalizeMoney(concessionData?.sakthi || 0)
  };

  yearRecord.concessions = {
    ...yearRecord.concessions,
    ...safeConcessions
  };

  const totalConcession =
    (yearRecord.concessions.firstGraduate || 0) +
    (yearRecord.concessions.scheme7point5 || 0) +
    (yearRecord.concessions.pmss || 0) +
    (yearRecord.concessions.sakthi || 0);

  yearRecord.concessions.totalConcession = normalizeMoney(totalConcession);

  yearRecord.academic = yearRecord.academic || {};
  yearRecord.academic.academicSpecialConcession = yearRecord.concessions.totalConcession;

  tracking.markModified("academicYearWiseRecord");
  await tracking.save();

  return yearRecord.concessions;
};

module.exports = {
  getFeesSummary,
  getStudentFeeSummary,
  getStudentsForFilter,
  createReceipt,
  updateReceipt,
  updateConcession
};
