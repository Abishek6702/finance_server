const AppError = require("../../utils/AppError");

const QUOTAS = ["Management Quota", "Government Quota"];
const EDUCATION_TYPES = ["UG", "PG"];
const DEGREE_PROGRAMS = ["BE", "BTech", "ME", "MTech"];
const DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];
const HOSTEL_SHARING = ["Two", "Three", "Four", "Five"];

const validateFeeStructure = (req, res, next) => {
  const { academicYear, academicStructures, hostelStructures } = req.body;
  
  if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
    return next(new AppError("Valid academicYear (YYYY-YYYY) is required.", 400));
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

  if (hostelStructures !== undefined) {
    if (!Array.isArray(hostelStructures)) {
      return next(new AppError("hostelStructures must be an array.", 400));
    }
    for (const hostel of hostelStructures) {
      if (hostel.roomType && hostel.roomType.sharingType) {
        if (!HOSTEL_SHARING.includes(hostel.roomType.sharingType)) {
          return next(new AppError(`Invalid hostel sharingType. Allowed: ${HOSTEL_SHARING.join(', ')}`, 400));
        }
      }
    }
  }

  next();
};

module.exports = { validateFeeStructure };
