const StudentFeeTracking = require("./model.studentFeeTracking");
const Student = require("../students/model.student");
const AppError = require("../../utils/AppError");

/* ────────────────────────────────────────────────
   GET / — get student(s) data + fee tracking records
   Filters: batch, department, rollNo
──────────────────────────────────────────────── */
const getStudents = async (query = {}) => {
  const search = {};
  if (query.batch) search["academic.batch"] = query.batch;
  if (query.department) search["academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, "i") };
  if (query.rollNo) search["personal.rollNo"] = query.rollNo.toUpperCase();

  const students = await Student.find(search).lean();
  if (!students.length) return [];

  const rollNos = students.map((s) => s.personal?.rollNo).filter(Boolean);
  const trackings = await StudentFeeTracking.find({ rollNo: { $in: rollNos } }).lean();
  const trackingMap = trackings.reduce((acc, t) => { acc[t.rollNo] = t; return acc; }, {});

  // Strip internal fields that are redundant alongside the already-returned student object
  const stripTracking = (t) => {
    if (!t) return null;
    const { _id, student, ...rest } = t;
    return rest;
  };

  return students.map((s) => ({
    student: s,
    feeTracking: stripTracking(trackingMap[s.personal?.rollNo] || null),
  }));
};

module.exports = { getStudents };
