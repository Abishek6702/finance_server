const validateStudent = (req, res, next) => {
  // simple validation
  const { personal, academic } = req.body;
  if (!personal || !personal.rollNo) {
    return res.status(400).json({ success: false, message: "personal.rollNo is required" });
  }
  if (!academic || !academic.batch || !academic.currentAcademicYear) {
    return res.status(400).json({ success: false, message: "academic.batch and academic.currentAcademicYear are required" });
  }
  next();
};

module.exports = { validateStudent };
