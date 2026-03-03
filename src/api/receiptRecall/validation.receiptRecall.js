const mongoose = require("mongoose");
const AppError = require("../../utils/AppError");

const validateCreateRecall = (req, res, next) => {
  const { receiptNo, rollNo, reason } = req.body;
 
  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return next(new AppError("reason is required", 400));
  }

  req.body = {
    receiptNo: receiptNo.trim(),
    rollNo: rollNo.trim(),
    reason: reason.trim(),
  };

  next();
};

const validateRecallAction = (req, res, next) => {
  const { recallId } = req.params;

  if (!recallId || !mongoose.Types.ObjectId.isValid(recallId)) {
    return next(new AppError("Valid recallId is required", 400));
  }

  next();
};

const validateRejectAction = (req, res, next) => {
  const { recallId } = req.params;

  if (!recallId || !mongoose.Types.ObjectId.isValid(recallId)) {
    return next(new AppError("Valid recallId is required", 400));
  }

  const { rejectReason } = req.body;
  if (!rejectReason || typeof rejectReason !== "string" || !rejectReason.trim()) {
    return next(new AppError("rejectReason is required", 400));
  }

  req.body = { rejectReason: rejectReason.trim() };

  next();
};

const validateGetRecalls = (req, res, next) => {
  const { status, page, limit } = req.query;

  const validStatuses = ["PENDING", "APPROVED", "REJECTED", "COMPLETED"];
  if (status && !validStatuses.includes(status)) {
    return next(new AppError(`status must be one of: ${validStatuses.join(", ")}`, 400));
  }

  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return next(new AppError("page must be a positive integer", 400));
  }
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
    return next(new AppError("limit must be a positive integer", 400));
  }

  next();
};

module.exports = { validateCreateRecall, validateRecallAction, validateRejectAction, validateGetRecalls };

