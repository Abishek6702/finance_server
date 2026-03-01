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

const validateUpdateReceipt = (req, res, next) => {
  const { paymentType, bankName, bankLocation, remarks } = req.body;
  if (!paymentType && !bankName && !bankLocation && !remarks) {
    return next(new AppError("No valid fields provided for update", 400));
  }
  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"];
  if (paymentType && !validPaymentTypes.includes(paymentType)) {
    return next(new AppError("Valid paymentType is required", 400));
  }
  next();
};

const validateUpdateConcession = (req, res, next) => {
  const { concessions } = req.body;
  if (!concessions || typeof concessions !== "object") {
    return next(new AppError("concessions object is required", 400));
  }

  const allowed = ["firstGraduate", "scheme7point5", "pmss", "sakthi"];
  const sanitized = {};

  for (const key of allowed) {
    if (concessions[key] === undefined) continue;
    if (!isValidMoney(concessions[key])) {
      return next(new AppError(`${key} must be a non-negative number with up to 2 decimals`, 400));
    }
    sanitized[key] = toMoney(concessions[key]);
  }

  req.body.concessions = sanitized;
  next();
};

module.exports = {
  validateUpdateReceipt,
  validateUpdateConcession
};
