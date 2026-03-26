const AppError = require("../../../utils/appError");

const YEAR_REGEX = /^\d{4}-\d{4}$/;

const validateFacilityChange = (req, res, next) => {
  const { transport, hostel, applyFromAcademicYear, effectiveDate, facilityType } = req.body;

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

  next();
};

const validateFacilityRemoval = (req, res, next) => {
  const { facilityType, applyFromAcademicYear, endDate, conceptionAmount, refundMode, refundAmount } = req.body;

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

  if (conceptionAmount === undefined || typeof conceptionAmount !== 'number' || conceptionAmount < 0) {
    return next(new AppError("conceptionAmount must be a non-negative number", 400));
  }

  if (!refundMode || !['wallet', 'cash', 'bank'].includes(refundMode)) {
    return next(new AppError("Valid refundMode (wallet, cash, or bank) is required", 400));
  }

  if (refundAmount !== undefined && (typeof refundAmount !== 'number' || refundAmount < 0)) {
    return next(new AppError("refundAmount must be a non-negative number when provided", 400));
  }

  next();
};

module.exports = { validateFacilityChange, validateFacilityRemoval };

