const recallService = require("./service.receiptRecall");
const asyncHandler = require("../../utils/asyncHandler");

const createRecallRequest = asyncHandler(async (req, res) => {
  const data = await recallService.createRecallRequest(req.body, req.user._id);
  res.status(201).json({ success: true, data, message: "Recall request created successfully" });
});

const getRecallRequests = asyncHandler(async (req, res) => {
  const data = await recallService.getRecallRequests(req.query);
  res.status(200).json({ success: true, data, message: "Recall requests fetched successfully" });
});

const approveRecall = asyncHandler(async (req, res) => {
  const data = await recallService.approveRecall(req.params.recallId, req.user._id);
  res.status(200).json({ success: true, data, message: "Recall approved and rollback completed" });
});

const rejectRecall = asyncHandler(async (req, res) => {
  const data = await recallService.rejectRecall(req.params.recallId, req.user._id, req.body.rejectReason);
  res.status(200).json({ success: true, data, message: "Recall request rejected" });
});

module.exports = {
  createRecallRequest,
  getRecallRequests,
  approveRecall,
  rejectRecall,
};
