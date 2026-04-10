const AppError = require("../../../utils/appError");

const QUOTAS = ["Management Quota", "Government Quota"];
const EDUCATION_TYPES = ["UG", "PG"];
const DEGREE_PROGRAMS = ["BE", "BTech", "ME", "MTech"];
const DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];
const HOSTEL_SHARING = ["Two", "Three", "Four", "Five"];

// Strip client-supplied totals — the model calculates them automatically
const stripTotals = (body) => {
  delete body.total;
  if (Array.isArray(body.academicStructures)) {
    body.academicStructures.forEach((struct) => {
      delete struct.total;
      if (Array.isArray(struct.departments)) {
        struct.departments.forEach((dept) => {
          delete dept.total;
          if (Array.isArray(dept.semesters)) {
            dept.semesters.forEach((sem) => delete sem.total);
          }
        });
      }
    });
  }
};

const validateFeeStructure = (req, res, next) => {
  // Remove any totals the client sent — we calculate them ourselves
  stripTotals(req.body);

  const { academicYear, academicStructures } = req.body;
  
  if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
    return next(new AppError("Valid academicYear (YYYY-YYYY) is required.", 400));
  }

  if (req.method === "POST") {
    if (!academicStructures || !Array.isArray(academicStructures) || academicStructures.length === 0) {
      return next(new AppError("At least one academic structure is required on creation.", 400));
    }
  }

  if (academicStructures !== undefined) {
    if (!Array.isArray(academicStructures)) {
      return next(new AppError("academicStructures must be an array.", 400));
    }
  
    for (const structure of academicStructures) {
      if (!QUOTAS.includes(structure.quota)) return next(new AppError(`Invalid quota. Allowed: ${QUOTAS.join(', ')}`, 400));
      if (!EDUCATION_TYPES.includes(structure.educationType)) return next(new AppError(`Invalid educationType. Allowed: ${EDUCATION_TYPES.join(', ')}`, 400));
      if (!DEGREE_PROGRAMS.includes(structure.degreeProgram)) return next(new AppError(`Invalid degreeProgram. Allowed: ${DEGREE_PROGRAMS.join(', ')}`, 400));
      
      if (!Array.isArray(structure.departments)) {
        return next(new AppError("departments must be an array.", 400));
      }
      
      for (const dept of structure.departments) {
        if (!DEPARTMENTS.includes(dept.departmentName)) {
          return next(new AppError(`Invalid departmentName. Allowed: ${DEPARTMENTS.join(', ')}`, 400));
        }
        if (!Array.isArray(dept.semesters) || dept.semesters.length !== 8) {
          return next(new AppError("Each department must have exactly 8 semesters.", 400));
        }
      }
    }
  }

  next();
};

module.exports = { validateFeeStructure };
