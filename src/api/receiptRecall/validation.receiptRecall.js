const mongoose = require("mongoose");
const AppError = require("../../utils/AppError");

const validateCreateRecall = (req, res, next) => {
  const { receiptNo, rollNo, reason, breakdownIds } = req.body;

  if (!receiptNo || typeof receiptNo !== "string" || !receiptNo.trim()) {
    return next(new AppError("receiptNo is required", 400));
  }
  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return next(new AppError("reason is required", 400));
  }
  if (!Array.isArray(breakdownIds) || breakdownIds.length === 0) {
    return next(new AppError("breakdownIds must be a non-empty array of breakdown ObjectIds", 400));
  }
  for (const id of breakdownIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid breakdownId: ${id}`, 400));
    }
  }
  // Deduplicate
  const uniqueIds = [...new Set(breakdownIds.map(String))];

  req.body = {
    receiptNo: receiptNo.trim(),
    rollNo: rollNo.trim(),
    reason: reason.trim(),
    breakdownIds: uniqueIds,
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
