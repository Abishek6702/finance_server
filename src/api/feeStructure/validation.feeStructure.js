const validateFeeStructure = (req, res, next) => {
  const { academicYear } = req.body;
  if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
    return res.status(400).json({ success: false, message: "Valid academicYear (YYYY-YYYY) is required." });
  }
  next();
};

module.exports = { validateFeeStructure };
