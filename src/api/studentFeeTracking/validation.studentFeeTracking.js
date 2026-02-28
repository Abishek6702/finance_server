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
    return res.status(400).json({ success: false, message: "No valid fields provided for update" });
  }
  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"];
  if (paymentType && !validPaymentTypes.includes(paymentType)) {
    return res.status(400).json({ success: false, message: "Valid paymentType is required" });
  }
  next();
};

const validateUpdateConcession = (req, res, next) => {
  const { concessions } = req.body;
  if (!concessions || typeof concessions !== "object") {
    return res.status(400).json({ success: false, message: "concessions object is required" });
  }

  const allowed = ["firstGraduate", "scheme7point5", "pmss", "sakthi"];
  const sanitized = {};

  for (const key of allowed) {
    if (concessions[key] === undefined) continue;
    if (!isValidMoney(concessions[key])) {
      return res.status(400).json({ success: false, message: `${key} must be a non-negative number with up to 2 decimals` });
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
