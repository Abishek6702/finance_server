const AppError = require("../../../utils/appError");

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

module.exports = {
  validateGetQuery,
  validateBackfillRequest,
};
