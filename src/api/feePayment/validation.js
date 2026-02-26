const validatePayment = (req, res, next) => {
  const { rollNo, receiptNo, paymentType, breakdowns } = req.body;
  
  if (!rollNo) return res.status(400).json({ success: false, message: "rollNo is required" });
  if (!receiptNo) return res.status(400).json({ success: false, message: "receiptNo is required" });
  
  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"];
  if (!paymentType || !validPaymentTypes.includes(paymentType)) {
    return res.status(400).json({ success: false, message: "Valid paymentType is required" });
  }

  if (!breakdowns || !Array.isArray(breakdowns) || breakdowns.length === 0) {
    return res.status(400).json({ success: false, message: "breakdowns array is required" });
  }

  next();
};

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
  if (!concessions || typeof concessions !== 'object') {
    return res.status(400).json({ success: false, message: "concessions object is required" });
  }
  next();
};

module.exports = { validatePayment, validateUpdateReceipt, validateUpdateConcession };
