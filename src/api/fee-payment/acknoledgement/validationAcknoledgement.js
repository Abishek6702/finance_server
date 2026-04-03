const AppError = require("../../../utils/appError");
const mongoose = require("mongoose");

const MONEY_MAX = 1e12;
const VALID_UPDATE_STATUS = ["approved", "rejected"];

const isValidMoney = (value) => {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= 0
    && value <= MONEY_MAX
    && Math.round(value * 100) === value * 100;
};

const toMoney = (value) => Math.round(value * 100) / 100;

const validateAcknowledgment = (req, res, next) => {
  const { rollNo, receiptNo, paymentType, breakdowns } = req.body;
  const excessAmount = req.body.excessAmount;
  const totalAmount = req.body.totalAmount;
  const reductionId = req.body.reductionId;

  if (!rollNo) return next(new AppError("rollNo is required", 400));

  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD", "excessAmount", "reduction"];
  if (!paymentType || !validPaymentTypes.includes(paymentType)) {
    return next(new AppError("Valid paymentType is required", 400));
  }

  if (paymentType === "reduction") {
    if (!reductionId || typeof reductionId !== "string" || !mongoose.Types.ObjectId.isValid(reductionId)) {
      return next(new AppError("reductionId is required as a valid MongoDB ObjectId when paymentType is reduction", 400));
    }
  }

  if (!breakdowns || !Array.isArray(breakdowns) || breakdowns.length === 0) {
    return next(new AppError("breakdowns array is required", 400));
  }

  const sanitizedBreakdowns = [];
  let sanitizedExcessAmount;
  let sanitizedTotalAmount;

  for (const bd of breakdowns) {
    if (!bd || typeof bd !== "object") {
      return next(new AppError("Each breakdown must be an object", 400));
    }

    if (!bd.academicYear || !/^\d{4}-\d{4}$/.test(bd.academicYear)) {
      return next(new AppError("Valid breakdown.academicYear is required", 400));
    }

    const cleanAcademic = {};
    if (bd.academic && typeof bd.academic === "object") {
      if (bd.academic.semesterNumber !== undefined) {
        if (!Number.isInteger(bd.academic.semesterNumber) || bd.academic.semesterNumber < 1 || bd.academic.semesterNumber > 8) {
          return next(new AppError("academic.semesterNumber must be an integer between 1 and 8", 400));
        }
        cleanAcademic.semesterNumber = bd.academic.semesterNumber;
      }

      const academicFields = ["tuition", "exam", "erp", "book", "lab"];
      for (const field of academicFields) {
        const value = bd.academic[field] === undefined ? 0 : bd.academic[field];
        if (!isValidMoney(value)) {
          return next(new AppError(`academic.${field} must be a non-negative number with up to 2 decimals`, 400));
        }
        cleanAcademic[field] = toMoney(value);
      }

      if (cleanAcademic.semesterNumber === undefined) {
        const hasAcademicFees = academicFields.some(f => cleanAcademic[f] > 0);
        if (hasAcademicFees) {
          return next(new AppError("academic.semesterNumber is required when academic fee amounts are provided", 400));
        }
      }
    }

    const hostelValue = bd.hostel === undefined ? 0 : bd.hostel;
    const transportValue = bd.transport === undefined ? 0 : bd.transport;

    if (!isValidMoney(hostelValue)) {
      return next(new AppError("hostel must be a non-negative number with up to 2 decimals", 400));
    }
    if (!isValidMoney(transportValue)) {
      return next(new AppError("transport must be a non-negative number with up to 2 decimals", 400));
    }

    sanitizedBreakdowns.push({
      academicYear: bd.academicYear,
      academic: cleanAcademic,
      hostel: toMoney(hostelValue),
      transport: toMoney(transportValue)
    });
  }

  if (excessAmount !== undefined) {
    if (!isValidMoney(excessAmount)) {
      return next(new AppError("excessAmount must be a non-negative number with up to 2 decimals", 400));
    }
    sanitizedExcessAmount = toMoney(excessAmount);
  }

  if (totalAmount !== undefined) {
    if (!isValidMoney(totalAmount)) {
      return next(new AppError("totalAmount must be a non-negative number with up to 2 decimals", 400));
    }
    sanitizedTotalAmount = toMoney(totalAmount);
  }

  req.body = {
    rollNo,
    receiptNo,
    paymentType,
    bankName: req.body.bankName,
    bankLocation: req.body.bankLocation,
    reductionId: typeof reductionId === "string" ? reductionId.trim() : undefined,
    billingDate: req.body.billingDate,
    breakdowns: sanitizedBreakdowns,
    excessAmount: sanitizedExcessAmount,
    totalAmount: sanitizedTotalAmount
  };

  next();
};

const validateUpdateAcknowledgment = (req, res, next) => {
  const { rollNo, receiptNo, status } = req.body;
  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }
  if (!receiptNo || typeof receiptNo !== "string" || !receiptNo.trim()) {
    return next(new AppError("receiptNo is required", 400));
  }
  if (!status || !["SUCCESSFUL", "REJECTED"].includes(status)) {
    return next(new AppError("status must be either SUCCESSFUL or REJECTED", 400));
  }
  next();
};

const validateCreateAcknowledgmentV2 = (req, res, next) => {
  const { rollNo, paymentType, bankName, totalAmount, date, message } = req.body;

  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }

  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD", "excessAmount", "reduction"];
  if (!paymentType || !validPaymentTypes.includes(paymentType)) {
    return next(new AppError("Valid paymentType is required", 400));
  }

  if (bankName !== undefined && (typeof bankName !== "string" || !bankName.trim())) {
    return next(new AppError("bankName must be a non-empty string when provided", 400));
  }

  const parsedAmount = Number(totalAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return next(new AppError("totalAmount must be a non-negative number", 400));
  }

  let parsedDate = new Date();
  if (date !== undefined) {
    parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return next(new AppError("date must be a valid date", 400));
    }
  }

  if (message !== undefined && (typeof message !== "string" || !message.trim())) {
    return next(new AppError("message must be a non-empty string when provided", 400));
  }

  req.body = {
    rollNo: rollNo.trim(),
    paymentType,
    bankName: typeof bankName === "string" ? bankName.trim() : null,
    totalAmount: Math.round(parsedAmount * 100) / 100,
    date: parsedDate,
    message: typeof message === "string" ? message.trim() : undefined,
  };

  next();
};

const validateUpdateAcknowledgmentV2 = (req, res, next) => {
  const { rollNo, ackId, status, message } = req.body;

  if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
    return next(new AppError("rollNo is required", 400));
  }

  if (!ackId || typeof ackId !== "string" || !ackId.trim()) {
    return next(new AppError("ackId is required", 400));
  }

  if (!status || typeof status !== "string" || !VALID_UPDATE_STATUS.includes(status.toLowerCase())) {
    return next(new AppError("status must be either approved or rejected", 400));
  }

  if (message !== undefined && (typeof message !== "string" || !message.trim())) {
    return next(new AppError("message must be a non-empty string when provided", 400));
  }

  req.body = {
    rollNo: rollNo.trim(),
    ackId: ackId.trim(),
    status: status.toLowerCase(),
    message: typeof message === "string" ? message.trim() : undefined,
  };

  next();
};

const validateAckIdParamV2 = (req, res, next) => {
  const { ackId } = req.params;

  if (!ackId || typeof ackId !== "string" || !ackId.trim()) {
    return next(new AppError("ackId path parameter is required", 400));
  }

  req.params.ackId = ackId.trim();
  next();
};

module.exports = {
  validateAcknowledgment,
  validateUpdateAcknowledgment,
  validateCreateAcknowledgmentV2,
  validateUpdateAcknowledgmentV2,
  validateAckIdParamV2
};
