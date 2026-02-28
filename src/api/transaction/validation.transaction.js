const AppError = require("../../utils/AppError");

const MONEY_MAX = 1e12;

const isValidMoney = (value) => {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= 0
    && value <= MONEY_MAX
    && Math.round(value * 100) === value * 100;
};

const toMoney = (value) => Math.round(value * 100) / 100;

const validatePayment = (req, res, next) => {
  const { rollNo, receiptNo, paymentType, breakdowns } = req.body;

  if (!rollNo) return next(new AppError("rollNo is required", 400));
  if (!receiptNo) return next(new AppError("receiptNo is required", 400));

  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"];
  if (!paymentType || !validPaymentTypes.includes(paymentType)) {
    return next(new AppError("Valid paymentType is required", 400));
  }

  if (!breakdowns || !Array.isArray(breakdowns) || breakdowns.length === 0) {
    return next(new AppError("breakdowns array is required", 400));
  }

  const sanitizedBreakdowns = [];

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

  req.body = {
    rollNo,
    receiptNo,
    paymentType,
    bankName: req.body.bankName,
    bankLocation: req.body.bankLocation,
    remarks: req.body.remarks,
    breakdowns: sanitizedBreakdowns
  };

  next();
};

module.exports = { validatePayment };
