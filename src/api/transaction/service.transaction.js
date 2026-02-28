const StudentTransaction = require("./model.studentTransaction");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");

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
  if (!tracking) throw new Error("Fee tracking not found for this student");

  let transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    const student = await Student.findOne({ "personal.rollNo": rollNo });
    if (!student) throw new Error("Student not found");
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
  if (!transactionDoc) throw new Error("Transactions not found for this student");
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

module.exports = {
  recordPayment,
  getStudentTransactions,
  getRecentPayments
};
