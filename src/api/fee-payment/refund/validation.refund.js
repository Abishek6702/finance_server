const AppError = require("../../../utils/appError");

const ACADEMIC_HEADS = new Set(["tuition", "exam", "erp", "book", "lab"]);
const ALL_FEE_HEADS = ["tuition", "exam", "erp", "book", "lab", "hostel", "transport", "excessAmount"];

const validateCreateRefund = (req, res, next) => {
  const { rollNo } = req.params;
  const {
    academicYear,
    semNumber,
    feeHead,
    refundAmount,
    reason,
    isActive,
    refundMode,
    refundVia,
    paymentFrom,
    studentAccount,
    studentAccountNumber,
    studentBankName,
  } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'];

  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }
  if (!academicYear || typeof academicYear !== "string" || !/^\d{4}-\d{4}$/.test(academicYear.trim())) {
    return next(new AppError("academicYear is required in YYYY-YYYY format", 400));
  }
  if (!feeHead || !ALL_FEE_HEADS.includes(feeHead)) {
    return next(
      new AppError(`feeHead is required and must be one of: ${ALL_FEE_HEADS.join(", ")}`, 400)
    );
  }
  if (ACADEMIC_HEADS.has(feeHead)) {
    if (semNumber === undefined || semNumber === null || semNumber === "") {
      return next(new AppError(`semNumber is required for academic fee head '${feeHead}'`, 400));
    }
    const sem = Number(semNumber);
    if (!Number.isInteger(sem) || sem < 1 || sem > 8) {
      return next(new AppError("semNumber must be an integer between 1 and 8", 400));
    }
  }
  if (refundAmount === undefined || refundAmount === null || refundAmount === "") {
    return next(new AppError("refundAmount is required", 400));
  }
  const amount = Number(refundAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return next(new AppError("refundAmount must be a positive number", 400));
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return next(new AppError("reason is required", 400));
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return next(new AppError("isActive must be a boolean when provided", 400));
  }

  if (feeHead === "excessAmount" && isActive === false) {
    return next(new AppError("isActive=false is not supported for excessAmount refunds", 400));
  }

  const normalizedMode = String(refundMode || refundVia || "").trim().toLowerCase();
  const normalizedPaymentFrom = String(paymentFrom || "").trim();
  const normalizedStudentBankName = String(studentBankName || "").trim();
  const normalizedStudentAccount = String(studentAccountNumber || studentAccount || "").trim();

  let finalMode = normalizedMode;
  const hasAnyBankField = Boolean(
    normalizedPaymentFrom || normalizedStudentBankName || normalizedStudentAccount
  );

  if (!finalMode) {
    finalMode = hasAnyBankField ? "bank" : "cash";
  }

  if (!["cash", "bank"].includes(finalMode)) {
    return next(new AppError("refundMode/refundVia must be either cash or bank", 400));
  }

  if (finalMode === "bank") {
    if (!normalizedPaymentFrom) {
      return next(new AppError("paymentFrom is required when refund mode is bank", 400));
    }
    if (!normalizedStudentAccount) {
      return next(new AppError("studentAccountNumber is required when refund mode is bank", 400));
    }
    if (!normalizedStudentBankName) {
      return next(new AppError("studentBankName is required when refund mode is bank", 400));
    }
  }

  req.params.rollNo = rollNo.trim().toUpperCase();
  req.body.academicYear = academicYear.trim();
  req.body.feeHead = feeHead;
  req.body.refundAmount = amount;
  req.body.reason = reason.trim();
  req.body.isActive = isActive === false ? false : true;
  req.body.refundMode = finalMode;
  req.body.paymentFrom = finalMode === "bank" ? normalizedPaymentFrom : null;
  req.body.studentBankName = finalMode === "bank" ? normalizedStudentBankName : null;
  req.body.studentAccount = finalMode === "bank" ? normalizedStudentAccount : null;
  req.body.studentAccountNumber = req.body.studentAccount;
  if (ACADEMIC_HEADS.has(feeHead)) {
    req.body.semNumber = Number(semNumber);
  }

  next();
};

const validateGetQuery = (req, res, next) => {
  const { page, limit, year, department, mode, date } = req.query;

  if (year && (typeof year !== "string" || !/^\d{4}-\d{4}$/.test(year.trim()))) {
    return next(new AppError("year must be in YYYY-YYYY format", 400));
  }

  if (department && (typeof department !== "string" || !department.trim())) {
    return next(new AppError("department must be a non-empty string", 400));
  }

  if (mode) {
    const normalizedMode = String(mode).trim().toLowerCase();
    if (!["cash", "bank"].includes(normalizedMode)) {
      return next(new AppError("mode must be either cash or bank", 400));
    }
    req.query.mode = normalizedMode;
  }

  if (date) {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return next(new AppError("date must be a valid date", 400));
    }
  }

  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return next(new AppError("page must be a positive integer", 400));
  }
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
    return next(new AppError("limit must be a positive integer", 400));
  }

  if (year) req.query.year = year.trim();
  if (department) req.query.department = department.trim().toUpperCase();

  next();
};

module.exports = { validateCreateRefund, validateGetQuery };
