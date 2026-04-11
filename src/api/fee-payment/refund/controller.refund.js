const refundService = require("./service.refund");
const asyncHandler = require("../../../utils/asyncHandler");

const createRefund = asyncHandler(async (req, res) => {
  const data = { ...req.body, rollNo: req.params.rollNo, idempotencyKey: req.headers['x-idempotency-key'] };
  const refund = await refundService.createRefund(data, req.user._id);
  res.status(201).json({ success: true, data: refund, message: "Refund processed successfully" });
});

const getRefundFlatReport = asyncHandler(async (req, res) => {
  const data = await refundService.getRefundFlatReport(req.query);
  res.status(200).json({ success: true, data, message: "Refunds fetched successfully" });
});

module.exports = {
  createRefund,
  getRefundFlatReport,
};
