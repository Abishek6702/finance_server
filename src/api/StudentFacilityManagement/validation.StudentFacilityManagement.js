const AppError = require("../../utils/AppError");

const YEAR_REGEX = /^\d{4}-\d{4}$/;

const validateFacilityChange = (req, res, next) => {
  const { transport, hostel, applyFromAcademicYear } = req.body;

  if (!applyFromAcademicYear) {
    return next(new AppError("applyFromAcademicYear is required", 400));
  }

  if (!YEAR_REGEX.test(applyFromAcademicYear)) {
    return next(new AppError("applyFromAcademicYear must be in YYYY-YYYY format", 400));
  }

  if (transport === undefined && hostel === undefined) {
    return next(new AppError("At least one of transport or hostel must be provided", 400));
  }

  if (transport !== undefined) {
    if (typeof transport.isApplicable !== "boolean") {
      return next(new AppError("transport.isApplicable must be a boolean", 400));
    }
    if (transport.isApplicable) {
      if (!transport.route) {
        return next(new AppError("transport.route is required when transport.isApplicable is true", 400));
      }
      if (!transport.stopName) {
        return next(new AppError("transport.stopName is required when transport.isApplicable is true", 400));
      }
    }
  }

  if (hostel !== undefined) {
    if (typeof hostel.isApplicable !== "boolean") {
      return next(new AppError("hostel.isApplicable must be a boolean", 400));
    }
    if (hostel.isApplicable) {
      if (!hostel.block) {
        return next(new AppError("hostel.block is required when hostel.isApplicable is true", 400));
      }
      if (hostel.sharing === undefined || hostel.sharing === null) {
        return next(new AppError("hostel.sharing is required when hostel.isApplicable is true", 400));
      }
      if (hostel.isAttached === undefined || hostel.isAttached === null) {
        return next(new AppError("hostel.isAttached is required when hostel.isApplicable is true", 400));
      }
    }
  }

  next();
};

module.exports = { validateFacilityChange };
