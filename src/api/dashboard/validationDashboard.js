const AppError = require("../../utils/appError");

const DEPARTMENT_ALIASES = {
  "CYBER SECURITY": "CSE(CYB)",
  "CSE(CYB)": "CSE(CYB)",
  CSBS: "CSBS",
  CSE: "CSE",
  ECE: "ECE",
  MECH: "MECH",
  IT: "IT",
  CCE: "CCE",
  EEE: "EEE",
  AIDS: "AIDS",
  AIML: "AIML",
};

const normalizeYear = (value) => (typeof value === "string" ? value.trim() : "");

const validateAcademicYear = (year) => {
  if (!year) {
    throw new AppError("year is required", 400);
  }

  if (!/^\d{4}-\d{4}$/.test(year)) {
    throw new AppError("year must be in YYYY-YYYY format", 400);
  }
};

exports.validateStudentsCountQuery = (req, res, next) => {
  try {
    const year = normalizeYear(req.query.year);
    validateAcademicYear(year);
    req.query.year = year;
    next();
  } catch (error) {
    next(error);
  }
};

exports.validateDepartmentDistributionQuery = (req, res, next) => {
  try {
    const year = normalizeYear(req.query.year);
    const dept = typeof req.query.dept === "string" ? req.query.dept.trim() : "";

    validateAcademicYear(year);

    if (!dept) {
      throw new AppError("dept is required", 400);
    }

    const normalizedDept = DEPARTMENT_ALIASES[dept.toUpperCase()];
    if (!normalizedDept) {
      throw new AppError("dept is invalid", 400);
    }

    req.query.year = year;
    req.query.dept = normalizedDept;
    next();
  } catch (error) {
    next(error);
  }
};

exports.validateFeesStatusQuery = (req, res, next) => {
  try {
    const year = normalizeYear(req.query.year);
    validateAcademicYear(year);
    req.query.year = year;
    next();
  } catch (error) {
    next(error);
  }
};
