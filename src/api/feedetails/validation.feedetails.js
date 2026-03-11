const AppError = require("../../utils/AppError");

const VALID_DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];

const validateGetList = (req, res, next) => {
  const { rollNo, batch, department, academicYear, studyingYear } = req.query;

  if (department && !VALID_DEPARTMENTS.includes(department.toUpperCase())) {
    return next(new AppError(`department must be one of: ${VALID_DEPARTMENTS.join(", ")}`, 400));
  }

  if (batch && !/^\d{4}-\d{4}$/.test(batch)) {
    return next(new AppError("batch must be in YYYY-YYYY format", 400));
  }

  if (academicYear && !/^\d{4}-\d{4}$/.test(academicYear)) {
    return next(new AppError("academicYear must be in YYYY-YYYY format", 400));
  }
  
  if (studyingYear && !/^[1-4]$/.test(studyingYear)) {
    return next(new AppError("studyingYear must be a number between 1 and 4", 400));
  }

  if (rollNo && !/^[A-Za-z0-9]+$/.test(rollNo)) {
    return next(new AppError("rollNo must be alphanumeric", 400));
  }

  next();
};

const validateGetByRollNo = (req, res, next) => {
  const { rollNo } = req.params;
  const { includeProfile } = req.query;

  if (!/^[A-Za-z0-9]+$/.test(rollNo)) {
    return next(new AppError("rollNo must be alphanumeric", 400));
  }

  if (includeProfile !== undefined && includeProfile !== "true" && includeProfile !== "false") {
    return next(new AppError("includeProfile must be 'true' or 'false'", 400));
  }

  next();
};

const validateGetBySemester = (req, res, next) => {
  const { rollNo, academicYear } = req.params;
  const { semester, includeProfile } = req.query;

  if (!/^[A-Za-z0-9]+$/.test(rollNo)) {
    return next(new AppError("rollNo must be alphanumeric", 400));
  }

  if (!/^\d{4}-\d{4}$/.test(academicYear)) {
    return next(new AppError("academicYear must be in YYYY-YYYY format", 400));
  }

  if (semester && !["odd", "even"].includes(semester.toLowerCase())) {
    return next(new AppError("semester must be 'odd' or 'even'", 400));
  }

  if (includeProfile !== undefined && includeProfile !== "true" && includeProfile !== "false") {
    return next(new AppError("includeProfile must be 'true' or 'false'", 400));
  }

  next();
};

module.exports = { validateGetList, validateGetByRollNo, validateGetBySemester };
