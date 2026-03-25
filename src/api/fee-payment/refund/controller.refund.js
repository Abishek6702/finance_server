const refundService = require("./service.refund");
const asyncHandler = require("../../../utils/asyncHandler");

const createRefund = asyncHandler(async (req, res) => {
  const data = { ...req.body, rollNo: req.params.rollNo, idempotencyKey: req.headers['x-idempotency-key'] };
  const refund = await refundService.createRefund(data, req.user._id);
  res.status(201).json({ success: true, data: refund, message: "Refund processed successfully" });
});

const getRefundsByStudent = asyncHandler(async (req, res) => {
  const data = await refundService.getRefundsByStudent(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Refunds fetched successfully" });
});

const getRefundsByYear = asyncHandler(async (req, res) => {
  const data = await refundService.getRefundsByYear(req.params.academicYear, req.query);
  res.status(200).json({ success: true, data, message: "Refunds fetched successfully" });
});

const getRefundReport = asyncHandler(async (req, res) => {
  const data = await refundService.getRefundReport(req.query);
  res.status(200).json({ success: true, data, message: "Refund report fetched successfully" });
});

module.exports = {
  createRefund,
  getRefundsByStudent,
  getRefundsByYear,
  getRefundReport,
};
