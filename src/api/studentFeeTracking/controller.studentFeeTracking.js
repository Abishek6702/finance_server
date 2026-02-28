const trackingService = require("./service.studentFeeTracking");

const getFeesSummary = async (req, res) => {
  try {
    const summary = await trackingService.getFeesSummary(req.query);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStudentFeeSummary = async (req, res) => {
  try {
    const summary = await trackingService.getStudentFeeSummary(req.params.rollNo);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getStudentsForFilter = async (req, res) => {
  try {
    const students = await trackingService.getStudentsForFilter(req.query);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateReceipt = async (req, res) => {
  try {
    const updated = await trackingService.updateReceipt(req.params.receiptNo, req.body, req.user);
    res.status(200).json({ success: true, data: updated, message: "Receipt updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateConcession = async (req, res) => {
  try {
    const updated = await trackingService.updateConcession(req.params.rollNo, req.params.academicYear, req.body.concessions);
    res.status(200).json({ success: true, data: updated, message: "Concessions updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getFeesSummary,
  getStudentFeeSummary,
  getStudentsForFilter,
  updateReceipt,
  updateConcession
};
