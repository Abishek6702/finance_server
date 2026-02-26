const StudentTransaction = require("../../models/StudentTransaction");
const StudentFeeTracking = require("../../models/StudentFeeTracking");
const Student = require("../../models/Student");
const ActivityLog = require("../../models/ActivityLog");

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

  // Calculate totals for breakdowns to save in transaction
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

  // Update Fee Tracking
  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) continue;

    // Helper to update amountSchema
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

         // Recalculate semester total paid
        const semPaid = normalizeMoney((sem.tuition?.paid || 0) + (sem.exam?.paid || 0) + (sem.erp?.paid || 0) + (sem.book?.paid || 0) + (sem.lab?.paid || 0));
        sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
        setStatus(sem.total);
      }
      
      // Target yearRecord academic total paid
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

    // Recalculate year total paid
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
    matchFilters["studentData.academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, 'i') };
  }
  if (query.paymentMode) {
    matchFilters["transactions.paymentType"] = { $regex: new RegExp(`^${query.paymentMode}$`, 'i') };
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

const getFeesSummary = async (query = {}) => {
  const year = query.year || "2025-2026"; 
  const filter = { "academicYearWiseRecord.academicYear": year };

  const records = await StudentFeeTracking.find(filter)
    .populate({
      path: "student",
      select: "personal.studentName personal.studentPhoto academic.departmentName academic.yearStudying enrollment.quota transport.isApplicable hostel.isApplicable"
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

  return {
    records: data,
    aggregate: {
      totalCollection,
      totalDue
    }
  };
};

const getStudentFeeSummary = async (rollNo) => {
  const record = await StudentFeeTracking.findOne({ rollNo })
    .populate("student")
    .lean();
    
  if (!record) throw new Error("Fee tracking not found for this student");

  const yearsSummary = record.academicYearWiseRecord.map(yearRecord => {
    const demand = yearRecord.total?.total || 0;
    const paid = yearRecord.total?.paid || 0;
    const concession = yearRecord.concessions?.totalConcession || 0;
    const overdue = Math.max(0, demand - paid);
    const status = yearRecord.total?.status || "Unpaid";
    
    return {
      academicYear: yearRecord.academicYear,
      demand,
      concession,
      paid,
      overdue,
      status,
      fine: 0,
      yearRecordDetails: yearRecord 
    };
  });

  return {
    studentProfile: record.student,
    feeSummaryRecords: yearsSummary
  };
};

const getStudentsForFilter = async (query = {}) => {
  const search = {};
  
  if (query.department) {
    search["academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, 'i') };
  }
  if (query.year) {
    search["academic.yearStudying"] = parseInt(query.year);
  }
  // Optional name filter
  if (query.name) {
    search["personal.studentName"] = { $regex: new RegExp(query.name, 'i') };
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
  if (!transactionDoc) throw new Error("Transaction not found");

  const transactionIndex = transactionDoc.transactions.findIndex(t => t.receiptNo === receiptNo);
  if (transactionIndex === -1) throw new Error("Transaction not found");

  const oldTransaction = transactionDoc.transactions[transactionIndex];
  
  // Only allow updating specific fields
  const allowedFields = ['paymentType', 'bankName', 'bankLocation', 'remarks'];
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
      endpoint: `/api/fee-payment/receipt/${receiptNo}`,
      method: 'PUT',
      module: 'Finance',
      description: `Updated receipt ${receiptNo}`,
      before: oldValue,
      after: newValue,
      meta: {
        email: user?.email || 'admin',
        status: 'Success'
      }
    });
  }

  return transactionDoc.transactions[transactionIndex];
};

const updateConcession = async (rollNo, academicYear, concessionData) => {
  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new Error("Fee tracking not found for this student");

  const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
  if (!yearRecord) throw new Error("Academic year record not found");

  // Update concessions
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

  // Recalculate total concession
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
  recordPayment, 
  getStudentTransactions,
  getRecentPayments,
  getFeesSummary,
  getStudentFeeSummary,
  getStudentsForFilter,
  updateReceipt,
  updateConcession
};
