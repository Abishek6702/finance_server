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

  return {
    records: filtered,
    aggregate: {
      totalCollection: normalizeMoney(totalCollection),
      totalDue: normalizeMoney(totalDue)
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
  updateReceipt,
  updateConcession
};
