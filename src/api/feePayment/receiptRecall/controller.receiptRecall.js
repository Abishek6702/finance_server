const recallService = require("./service.receiptRecall");
const asyncHandler = require("../../../utils/asyncHandler");

const createRecall = asyncHandler(async (req, res) => {
  const data = await recallService.createRecall(req.body, req.user._id);
  res.status(201).json({ success: true, data, message: "Breakdown(s) recalled successfully" });
});

const getRecalls = asyncHandler(async (req, res) => {
  const data = await recallService.getRecalls(req.query);
  res.status(200).json({ success: true, data, message: "Recall records fetched successfully" });
});

module.exports = {
  createRecall,
  getRecalls,
};
