const AppError = require("../../../utils/appError");
const {
  BULK_VALID_QUOTAS,
  BULK_VALID_EDUCATION_TYPES,
  BULK_VALID_DEGREE_PROGRAMS,
  BULK_VALID_DEPARTMENTS,
} = require("./serviceTrackingSyncInternal");

const VALID_DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];

const validateGetQuery = (req, res, next) => {
  const { batch, department, rollNo } = req.query;

  if (department && !VALID_DEPARTMENTS.includes(department.toUpperCase())) {
    return next(new AppError(`department must be one of: ${VALID_DEPARTMENTS.join(", ")}`, 400));
  }

  if (batch && !/^\d{4}-\d{4}$/.test(batch)) {
    return next(new AppError("batch must be in YYYY-YYYY format", 400));
  }

  if (rollNo && !/^[A-Za-z0-9]+$/.test(rollNo)) {
    return next(new AppError("rollNo must be alphanumeric", 400));
  }

  next();
};

const validateBackfillRequest = (req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    return next(new AppError("Request body is not allowed for this endpoint", 400));
  }

  if (req.query && Object.keys(req.query).length > 0) {
    return next(new AppError("Query params are not allowed for this endpoint", 400));
  }

  next();
};

const ensureAcademicYear = (value, fieldName) => {
  if (!value || typeof value !== "string" || !/^\d{4}-\d{4}$/.test(value)) {
    throw new AppError(`${fieldName} must be in YYYY-YYYY format`, 400);
  }
};

const validateTriggerFeeUpdate = (req, res, next) => {
  try {
    const {
      academicYear,
      quota,
      educationType,
      degreeProgram,
      departmentName,
      semesterNumber,
    } = req.body || {};

    ensureAcademicYear(academicYear, "academicYear");

    if (quota && !BULK_VALID_QUOTAS.includes(quota)) {
      throw new AppError(`quota must be one of: ${BULK_VALID_QUOTAS.join(", ")}`, 400);
    }

    if (educationType && !BULK_VALID_EDUCATION_TYPES.includes(educationType)) {
      throw new AppError(`educationType must be one of: ${BULK_VALID_EDUCATION_TYPES.join(", ")}`, 400);
    }

    if (degreeProgram && !BULK_VALID_DEGREE_PROGRAMS.includes(degreeProgram)) {
      throw new AppError(`degreeProgram must be one of: ${BULK_VALID_DEGREE_PROGRAMS.join(", ")}`, 400);
    }

    if (departmentName && !BULK_VALID_DEPARTMENTS.includes(departmentName)) {
      throw new AppError(`departmentName must be one of: ${BULK_VALID_DEPARTMENTS.join(", ")}`, 400);
    }

    if (semesterNumber !== undefined && (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 8)) {
      throw new AppError("semesterNumber must be an integer between 1 and 8", 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

const validatePromotionRequest = (req, res, next) => {
  try {
    const { currentAcademicYear } = req.body || {};
    ensureAcademicYear(currentAcademicYear, "currentAcademicYear");
    next();
  } catch (error) {
    next(error);
  }
};

const validateDepromotionRequest = (req, res, next) => {
  try {
    const { currentAcademicYear } = req.body || {};
    ensureAcademicYear(currentAcademicYear, "currentAcademicYear");
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateGetQuery,
  validateBackfillRequest,
  validateTriggerFeeUpdate,
  validatePromotionRequest,
  validateDepromotionRequest,
};
