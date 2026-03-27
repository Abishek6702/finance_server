const AppError = require("../../../utils/appError");

const YEAR_REGEX = /^\d{4}-\d{4}$/;
const REFUND_MODES = ["wallet", "cash", "bank"];

const hasOnlyKeys = (obj, allowedKeys) => {
  const keys = Object.keys(obj || {});
  return keys.every((key) => allowedKeys.includes(key));
};

const isValidDateString = (value) => Boolean(value) && !isNaN(Date.parse(value));

const validateFacilityChange = (req, res, next) => {
  const { transport, hostel, applyFromAcademicYear, effectiveDate, facilityType, reduction } = req.body;

  if (!applyFromAcademicYear) {
    return next(new AppError("applyFromAcademicYear is required", 400));
  }

  if (!YEAR_REGEX.test(applyFromAcademicYear)) {
    return next(new AppError("applyFromAcademicYear must be in YYYY-YYYY format", 400));
  }

  if (transport === undefined && hostel === undefined) {
    return next(new AppError("At least one of transport or hostel must be provided", 400));
  }

  if (facilityType !== undefined) {
    if (!["transport", "hostel"].includes(facilityType)) {
      return next(new AppError("facilityType must be either transport or hostel", 400));
    }
    if (facilityType === "transport" && transport === undefined) {
      return next(new AppError("transport payload is required when facilityType is transport", 400));
    }
    if (facilityType === "hostel" && hostel === undefined) {
      return next(new AppError("hostel payload is required when facilityType is hostel", 400));
    }
  }

  if (transport !== undefined) {
    if (transport.isApplicable !== true) {
      return next(new AppError("assign facility only accepts isApplicable: true. Use /cancel to remove a facility.", 400));
    }
    if (!transport.id) {
      return next(new AppError("transport.id is required", 400));
    }
  }

  if (hostel !== undefined) {
    if (hostel.isApplicable !== true) {
      return next(new AppError("assign facility only accepts isApplicable: true. Use /cancel to remove a facility.", 400));
    }
    if (!hostel.id) {
      return next(new AppError("hostel.id is required", 400));
    }
  }

  const requiresEffectiveDate =
    (transport?.isApplicable === true) ||
    (hostel?.isApplicable === true);

  if (requiresEffectiveDate) {
    if (!effectiveDate || isNaN(Date.parse(effectiveDate))) {
      return next(new AppError("effectiveDate is required and must be a valid date when adding a facility", 400));
    }
  }

  if (reduction !== undefined) {
    if (typeof reduction !== "number" || Number.isNaN(reduction) || reduction < 0) {
      return next(new AppError("reduction must be a non-negative number when provided", 400));
    }
  }

  next();
};

const validateFacilityRemoval = (req, res, next) => {
  const {
    facilityType,
    applyFromAcademicYear,
    endDate,
    conceptionAmount,
    refundMode,
    refundAmount,
    collegeAccount,
    studentBankName,
    studentAccount,
  } = req.body;

  if (!facilityType || !['transport', 'hostel'].includes(facilityType)) {
    return next(new AppError("Valid facilityType (transport or hostel) is required", 400));
  }

  if (!applyFromAcademicYear) {
    return next(new AppError("applyFromAcademicYear is required", 400));
  }

  if (!YEAR_REGEX.test(applyFromAcademicYear)) {
    return next(new AppError("applyFromAcademicYear must be in YYYY-YYYY format", 400));
  }

  if (!endDate || isNaN(Date.parse(endDate))) {
    return next(new AppError("Valid endDate is required", 400));
  }

  if (conceptionAmount !== undefined && (typeof conceptionAmount !== 'number' || conceptionAmount < 0)) {
    return next(new AppError("conceptionAmount must be a non-negative number when provided", 400));
  }

  if (refundMode !== undefined && !REFUND_MODES.includes(refundMode)) {
    return next(new AppError("Valid refundMode (wallet, cash, or bank) is required when provided", 400));
  }

  if (refundAmount !== undefined && (typeof refundAmount !== 'number' || refundAmount < 0)) {
    return next(new AppError("refundAmount must be a non-negative number when provided", 400));
  }

  if (refundMode === "bank") {
    if (!collegeAccount || typeof collegeAccount !== "string" || !collegeAccount.trim()) {
      return next(new AppError("collegeAccount is required when refundMode is bank", 400));
    }
    if (!studentBankName || typeof studentBankName !== "string" || !studentBankName.trim()) {
      return next(new AppError("studentBankName is required when refundMode is bank", 400));
    }
    if (!studentAccount || typeof studentAccount !== "string" || !studentAccount.trim()) {
      return next(new AppError("studentAccount is required when refundMode is bank", 400));
    }
  }

  next();
};

const validateCancelAndAssign = (req, res, next) => {
  const { cancel, assign } = req.body || {};
  const idempotencyKey = req.headers["x-idempotency-key"];

  if (!idempotencyKey || String(idempotencyKey).trim().length === 0) {
    return next(new AppError("x-idempotency-key header is required for cancel-assign operation", 400));
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return next(new AppError("Request body must be a valid object", 400));
  }

  if (!hasOnlyKeys(req.body, ["cancel", "assign"])) {
    return next(new AppError("Only cancel and assign blocks are allowed in request body", 400));
  }

  if (!cancel || typeof cancel !== "object" || Array.isArray(cancel)) {
    return next(new AppError("cancel block is required", 400));
  }

  if (!assign || typeof assign !== "object" || Array.isArray(assign)) {
    return next(new AppError("assign block is required", 400));
  }

  if (!hasOnlyKeys(cancel, ["facilityType", "applyFromAcademicYear", "endDate", "conceptionAmount", "refundMode", "refundAmount", "collegeAccount", "studentBankName", "studentAccount"])) {
    return next(new AppError("cancel block contains unsupported fields", 400));
  }

  if (!cancel.facilityType || !["transport", "hostel"].includes(cancel.facilityType)) {
    return next(new AppError("cancel.facilityType must be transport or hostel", 400));
  }

  if (!cancel.applyFromAcademicYear || !YEAR_REGEX.test(cancel.applyFromAcademicYear)) {
    return next(new AppError("cancel.applyFromAcademicYear must be in YYYY-YYYY format", 400));
  }

  if (!isValidDateString(cancel.endDate)) {
    return next(new AppError("cancel.endDate must be a valid date", 400));
  }

  if (
    cancel.conceptionAmount !== undefined &&
    (
      typeof cancel.conceptionAmount !== "number" ||
      Number.isNaN(cancel.conceptionAmount) ||
      cancel.conceptionAmount < 0
    )
  ) {
    return next(new AppError("cancel.conceptionAmount must be a non-negative number when provided", 400));
  }

  if (cancel.refundMode !== undefined && !REFUND_MODES.includes(cancel.refundMode)) {
    return next(new AppError("cancel.refundMode must be wallet, cash, or bank when provided", 400));
  }

  if (cancel.refundAmount !== undefined && (typeof cancel.refundAmount !== "number" || cancel.refundAmount < 0)) {
    return next(new AppError("cancel.refundAmount must be a non-negative number when provided", 400));
  }

  if (cancel.refundMode === "bank") {
    if (!cancel.collegeAccount || typeof cancel.collegeAccount !== "string" || !cancel.collegeAccount.trim()) {
      return next(new AppError("cancel.collegeAccount is required when cancel.refundMode is bank", 400));
    }
    if (!cancel.studentBankName || typeof cancel.studentBankName !== "string" || !cancel.studentBankName.trim()) {
      return next(new AppError("cancel.studentBankName is required when cancel.refundMode is bank", 400));
    }
    if (!cancel.studentAccount || typeof cancel.studentAccount !== "string" || !cancel.studentAccount.trim()) {
      return next(new AppError("cancel.studentAccount is required when cancel.refundMode is bank", 400));
    }
  }

  if (!hasOnlyKeys(assign, ["transport", "hostel", "applyFromAcademicYear", "effectiveDate", "reduction"])) {
    return next(new AppError("assign block contains unsupported fields", 400));
  }

  if (!assign.applyFromAcademicYear || !YEAR_REGEX.test(assign.applyFromAcademicYear)) {
    return next(new AppError("assign.applyFromAcademicYear must be in YYYY-YYYY format", 400));
  }

  if (!isValidDateString(assign.effectiveDate)) {
    return next(new AppError("assign.effectiveDate must be a valid date", 400));
  }

  if (
    assign.reduction !== undefined &&
    (typeof assign.reduction !== "number" || Number.isNaN(assign.reduction) || assign.reduction < 0)
  ) {
    return next(new AppError("assign.reduction must be a non-negative number when provided", 400));
  }

  const hasTransport = assign.transport !== undefined;
  const hasHostel = assign.hostel !== undefined;

  if (!hasTransport && !hasHostel) {
    return next(new AppError("assign block must include exactly one of transport or hostel", 400));
  }

  if (hasTransport && hasHostel) {
    return next(new AppError("assign block cannot include both transport and hostel in cancel-assign flow", 400));
  }

  const facilityPayload = hasTransport ? assign.transport : assign.hostel;
  const facilityLabel = hasTransport ? "assign.transport" : "assign.hostel";

  if (!facilityPayload || typeof facilityPayload !== "object" || Array.isArray(facilityPayload)) {
    return next(new AppError(`${facilityLabel} must be an object`, 400));
  }

  if (!hasOnlyKeys(facilityPayload, ["isApplicable", "id"])) {
    return next(new AppError(`${facilityLabel} supports only isApplicable and id fields`, 400));
  }

  if (facilityPayload.isApplicable !== true) {
    return next(new AppError(`${facilityLabel}.isApplicable must be true in cancel-assign flow`, 400));
  }

  if (!facilityPayload.id || typeof facilityPayload.id !== "string") {
    return next(new AppError(`${facilityLabel}.id is required`, 400));
  }

  if (cancel.applyFromAcademicYear !== assign.applyFromAcademicYear) {
    return next(new AppError("cancel.applyFromAcademicYear and assign.applyFromAcademicYear must be the same", 400));
  }

  if (new Date(assign.effectiveDate) <= new Date(cancel.endDate)) {
    return next(new AppError("assign.effectiveDate must be later than cancel.endDate", 400));
  }

  next();
};

module.exports = { validateFacilityChange, validateFacilityRemoval, validateCancelAndAssign };

