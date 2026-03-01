const trackingService = require("./service.studentFeeTracking");
const asyncHandler = require("../../utils/asyncHandler");

const getFeesSummary = asyncHandler(async (req, res) => {
  const data = await trackingService.getFeesSummary(req.query);
  res.status(200).json({ success: true, data, message: "Fees summary fetched successfully" });
});

const getStudentFeeSummary = asyncHandler(async (req, res) => {
  const data = await trackingService.getStudentFeeSummary(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Student fee summary fetched successfully" });
});

const getStudentsForFilter = asyncHandler(async (req, res) => {
  const data = await trackingService.getStudentsForFilter(req.query);
  res.status(200).json({ success: true, data, message: "Students fetched successfully" });
});

const updateReceipt = asyncHandler(async (req, res) => {
  const data = await trackingService.updateReceipt(req.params.receiptNo, req.body, req.user);
  res.status(200).json({ success: true, data, message: "Receipt updated successfully" });
});

const updateConcession = asyncHandler(async (req, res) => {
  const data = await trackingService.updateConcession(req.params.rollNo, req.params.academicYear, req.body.concessions);
  res.status(200).json({ success: true, data, message: "Concessions updated successfully" });
});

module.exports = {
  getFeesSummary,
  getStudentFeeSummary,
  getStudentsForFilter,
  updateReceipt,
  updateConcession
};
