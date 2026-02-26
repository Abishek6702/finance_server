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
  
  if (!rollNo) return res.status(400).json({ success: false, message: "rollNo is required" });
  if (!receiptNo) return res.status(400).json({ success: false, message: "receiptNo is required" });
  
  const validPaymentTypes = ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"];
  if (!paymentType || !validPaymentTypes.includes(paymentType)) {
    return res.status(400).json({ success: false, message: "Valid paymentType is required" });
  }

  if (!breakdowns || !Array.isArray(breakdowns) || breakdowns.length === 0) {
    return res.status(400).json({ success: false, message: "breakdowns array is required" });
  }

  const sanitizedBreakdowns = [];

  for (const bd of breakdowns) {
    if (!bd || typeof bd !== "object") {
      return res.status(400).json({ success: false, message: "Each breakdown must be an object" });
    }

    if (!bd.academicYear || !/^\d{4}-\d{4}$/.test(bd.academicYear)) {
      return res.status(400).json({ success: false, message: "Valid breakdown.academicYear is required" });
    }

    const cleanAcademic = {};
    if (bd.academic && typeof bd.academic === "object") {
      if (bd.academic.semesterNumber !== undefined) {
        if (!Number.isInteger(bd.academic.semesterNumber) || bd.academic.semesterNumber < 1 || bd.academic.semesterNumber > 8) {
          return res.status(400).json({ success: false, message: "academic.semesterNumber must be an integer between 1 and 8" });
        }
        cleanAcademic.semesterNumber = bd.academic.semesterNumber;
      }

      const academicFields = ["tuition", "exam", "erp", "book", "lab"];
      for (const field of academicFields) {
        const value = bd.academic[field] === undefined ? 0 : bd.academic[field];
        if (!isValidMoney(value)) {
          return res.status(400).json({ success: false, message: `academic.${field} must be a non-negative number with up to 2 decimals` });
        }
        cleanAcademic[field] = toMoney(value);
      }
    }

    const hostelValue = bd.hostel === undefined ? 0 : bd.hostel;
    const transportValue = bd.transport === undefined ? 0 : bd.transport;

    if (!isValidMoney(hostelValue)) {
      return res.status(400).json({ success: false, message: "hostel must be a non-negative number with up to 2 decimals" });
    }
    if (!isValidMoney(transportValue)) {
      return res.status(400).json({ success: false, message: "transport must be a non-negative number with up to 2 decimals" });
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

module.exports = { validatePayment, validateUpdateReceipt, validateUpdateConcession };
