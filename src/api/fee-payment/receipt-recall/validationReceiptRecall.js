const mongoose = require("mongoose");
const AppError = require("../../../utils/appError");

const validateCreateRecall = (req, res, next) => {
  const { receiptNo, rollNo, reason, feeHeadIds, breakdownId } = req.body;

  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return next(new AppError("reason is required", 400));
  }

  // Mode B: recall entire breakdown by its ID (no receiptNo or feeHeadIds needed)
  if (breakdownId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(breakdownId)) {
      return next(new AppError("Invalid breakdownId", 400));
    }
    req.body = {
      rollNo: rollNo.trim(),
      reason: reason.trim(),
      breakdownId: breakdownId.toString(),
    };
    return next();
  }

  // Mode A: recall specific fee heads by ID within a known receipt
  if (!receiptNo || typeof receiptNo !== "string" || !receiptNo.trim()) {
    return next(new AppError("receiptNo is required (or provide breakdownId)", 400));
  }
  if (!Array.isArray(feeHeadIds) || feeHeadIds.length === 0) {
    return next(new AppError("feeHeadIds must be a non-empty array of feeHead ObjectIds", 400));
  }
  for (const id of feeHeadIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid feeHeadId: ${id}`, 400));
    }
  }
  // Deduplicate
  const uniqueIds = [...new Set(feeHeadIds.map(String))];

  req.body = {
    receiptNo: receiptNo.trim(),
    rollNo: rollNo.trim(),
    reason: reason.trim(),
    feeHeadIds: uniqueIds,
  };

  next();
};

const validateGetRecalls = (req, res, next) => {
  const { page, limit } = req.query;

  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return next(new AppError("page must be a positive integer", 400));
  }
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
    return next(new AppError("limit must be a positive integer", 400));
  }

  next();
};

module.exports = { validateCreateRecall, validateGetRecalls };
