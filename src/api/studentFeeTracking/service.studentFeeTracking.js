const StudentFeeTracking = require("./model.studentFeeTracking");
const StudentTransaction = require("../transaction/model.studentTransaction");
const Student = require("../students/model.student");
const ActivityLog = require("../../models/ActivityLog");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
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

  return {
    records: data,
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
    search["academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, "i") };
  }
  if (query.year) {
    search["academic.yearStudying"] = parseInt(query.year);
  }
  if (query.name) {
    search["personal.studentName"] = { $regex: new RegExp(query.name, "i") };
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
  if (!tracking) throw new Error("Fee tracking not found for this student");

  const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
  if (!yearRecord) throw new Error("Academic year record not found");

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
