const AppError = require("../../../utils/appError");

const ACADEMIC_HEADS = new Set(["tuition", "exam", "erp", "book", "lab"]);
const ALL_FEE_HEADS = ["tuition", "exam", "erp", "book", "lab", "hostel", "transport", "excessAmount"];

const validateCreateRefund = (req, res, next) => {
  const { rollNo } = req.params;
  const { academicYear, semNumber, feeHead, refundAmount, reason, isActive } = req.body;
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

  req.params.rollNo = rollNo.trim().toUpperCase();
  req.body.academicYear = academicYear.trim();
  req.body.feeHead = feeHead;
  req.body.refundAmount = amount;
  req.body.reason = reason.trim();
  req.body.isActive = isActive === false ? false : true;
  if (ACADEMIC_HEADS.has(feeHead)) {
    req.body.semNumber = Number(semNumber);
  }

  next();
};

const validateGetQuery = (req, res, next) => {
  const { page, limit } = req.query;
  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return next(new AppError("page must be a positive integer", 400));
  }
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
    return next(new AppError("limit must be a positive integer", 400));
  }
  next();
};

module.exports = { validateCreateRefund, validateGetQuery };
