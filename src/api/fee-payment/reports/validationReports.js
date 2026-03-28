const AppError = require("../../../utils/appError");

exports.validateIndividualReportQuery = (req, res, next) => {
  let { rollNo, semester, fromDate, toDate } = req.query;

  if (!rollNo) {
    return next(new AppError("rollNo is required", 400));
  }

  // default date fallback
  if (!fromDate || !toDate) {
    const today = new Date().toISOString().split("T")[0];
    fromDate = fromDate || today;
    toDate = toDate || today;
    
    req.query.fromDate = fromDate;
    req.query.toDate = toDate;
  }

  // simple date validation
  if (isNaN(Date.parse(fromDate)) || isNaN(Date.parse(toDate))) {
    return next(new AppError(`Invalid date format. Use YYYY-MM-DD. fromDate=${fromDate}, toDate=${toDate}`, 400));
  }
  
  if (new Date(fromDate) > new Date(toDate)) {
    return next(new AppError("fromDate cannot be after toDate", 400));
  }

  if (semester && !["odd", "even"].includes(semester.toLowerCase())) {
    return next(new AppError("semester must be 'odd' or 'even'", 400));
  }

  next();
};

exports.validateDatewiseReportQuery = (req, res, next) => {
  let { fromDate, toDate, page, limit } = req.query;

  // default date fallback
  if (!fromDate || !toDate) {
    const today = new Date().toISOString().split("T")[0];
    fromDate = fromDate || today;
    toDate = toDate || today;
    
    req.query.fromDate = fromDate;
    req.query.toDate = toDate;
  }

  if (isNaN(Date.parse(fromDate)) || isNaN(Date.parse(toDate))) {
    return next(new AppError(`Invalid date format. Use YYYY-MM-DD. fromDate=${fromDate}, toDate=${toDate}`, 400));
  }
  
  if (new Date(fromDate) > new Date(toDate)) {
    return next(new AppError("fromDate cannot be after toDate", 400));
  }

  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return next(new AppError("page must be a positive integer", 400));
    }
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return next(new AppError("limit must be a positive integer", 400));
    }
  }

  next();
};

exports.validateClasswiseReportQuery = (req, res, next) => {
  const { yearOfStudying, studeingyear, status, page, limit } = req.query;

  const targetYearOfStudying = yearOfStudying || studeingyear;

  if (targetYearOfStudying) {
    const yearNum = parseInt(targetYearOfStudying, 10);
    if (isNaN(yearNum) || yearNum < 1) {
      return next(new AppError("yearOfStudying must be a positive integer", 400));
    }
  }

  if (status && !["paid", "unpaid", "partial"].includes(status.toLowerCase())) {
    return next(new AppError("status must be 'paid', 'unpaid', or 'partial'", 400));
  }

  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return next(new AppError("page must be a positive integer", 400));
    }
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return next(new AppError("limit must be a positive integer", 400));
    }
  }

  next();
};

exports.validateCumulativeBalanceHistoryQuery = (req, res, next) => {
  const { academicYear, yearOfStudying, studeingyear, status, page, limit } = req.query;

  if (!academicYear) {
    return next(new AppError("academicYear is required", 400));
  }

  const targetYearOfStudying = yearOfStudying || studeingyear;
  if (!targetYearOfStudying) {
    return next(new AppError("yearOfStudying is required", 400));
  }

  const yearNum = parseInt(targetYearOfStudying, 10);
  if (isNaN(yearNum) || yearNum < 1) {
    return next(new AppError("yearOfStudying must be a positive integer", 400));
  }

  if (status && !["paid", "unpaid", "partial"].includes(status.toLowerCase())) {
    return next(new AppError("status must be 'paid', 'unpaid', or 'partial'", 400));
  }

  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return next(new AppError("page must be a positive integer", 400));
    }
  }

  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return next(new AppError("limit must be a positive integer", 400));
    }
  }

  next();
};
