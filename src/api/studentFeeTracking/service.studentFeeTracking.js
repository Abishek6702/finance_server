const StudentFeeTracking = require("./model.studentFeeTracking");
const Student = require("../students/model.student");
const AppError = require("../../utils/AppError");

/* ────────────────────────────────────────────────
   Helper: Hide block data if isApplicable === false
   Keeps only { isApplicable: false }
──────────────────────────────────────────────── */
const cleanApplicableBlock = (block) => {
  if (!block) return null;

  if (block.isApplicable === false) {
    return { isApplicable: false };
  }

  return block;
};

/* ────────────────────────────────────────────────
   GET / — get student(s) data + fee tracking records
   Filters: batch, department, rollNo
──────────────────────────────────────────────── */
const getStudentsFeeTrackingData = async (query = {}) => {
  const search = {};

  if (query.batch) {
    search["academic.batch"] = query.batch;
  }

  if (query.department) {
    search["academic.departmentName"] = {
      $regex: new RegExp(`^${query.department}$`, "i"),
    };
  }

  if (query.rollNo) {
    search["personal.rollNo"] = query.rollNo.toUpperCase();
  }

  /* ────────────────────────────────────────────────
     Fetch ONLY required fields
  ──────────────────────────────────────────────── */
  const students = await Student.find(search) 
    .lean();

  if (!students.length) return [];

  const rollNos = students
    .map((s) => s.personal?.rollNo)
    .filter(Boolean);

  const trackings = await StudentFeeTracking.find({
    rollNo: { $in: rollNos },
  }).lean();

  const trackingMap = trackings.reduce((acc, t) => {
    acc[t.rollNo] = t;
    return acc;
  }, {});

  /* ────────────────────────────────────────────────
     Remove redundant internal fields from tracking
  ──────────────────────────────────────────────── */
const stripTracking = (t) => {
  if (!t) return null;

  const { _id, student, __v, rollNo, ...rest } = t;
  return rest;
};
  /* ────────────────────────────────────────────────
     Shape Final Response
  ──────────────────────────────────────────────── */
  return students.map((s) => ({
    student: {
      personal: {
        rollNo: s.personal?.rollNo,
        studentName: s.personal?.studentName,
        gender: s.personal?.gender,
        studentPhoto: s.personal?.studentPhoto,
      },

      academic: s.academic,
      contact: s.contact,

      enrollment: s.enrollment
        ? {
            quota: s.enrollment?.quota,

            firstGraduate: cleanApplicableBlock(
              s.enrollment?.firstGraduate
            ),
            scheme7point5: cleanApplicableBlock(
              s.enrollment?.scheme7point5
            ),
            pmssScheme: cleanApplicableBlock(
              s.enrollment?.pmssScheme
            ),
            sakthiScheme: cleanApplicableBlock(
              s.enrollment?.sakthiScheme
            ),
            specialConcession: cleanApplicableBlock(
              s.enrollment?.specialConcession
            ),
          }
        : null,

      transport: cleanApplicableBlock(s.transport),
      hostel: cleanApplicableBlock(s.hostel),
    },

    feeTracking: stripTracking(
      trackingMap[s.personal?.rollNo] || null
    ),
  }));
};

module.exports = { getStudentsFeeTrackingData };