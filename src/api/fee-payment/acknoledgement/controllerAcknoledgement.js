const acknoledgementService = require("./serviceacknoledgement");
const asyncHandler = require("../../../utils/asyncHandler");

const createAcknowledgment = asyncHandler(async (req, res) => {
  const data = await acknoledgementService.createAcknowledgment(req.body);
  res.status(201).json({ success: true, data, message: "Acknowledgment recorded successfully" });
});

const updateAcknowledgment = asyncHandler(async (req, res) => {
  const data = await acknoledgementService.updateAcknowledgment(req.body);
  res.status(200).json({ success: true, data, message: "Acknowledgment updated successfully" });
});

const createAcknowledgmentV2 = asyncHandler(async (req, res) => {
  const data = await acknoledgementService.createAcknowledgmentV2(req.body);
  res.status(201).json({ success: true, data, message: "Acknowledgment V2 recorded successfully" });
});

const getAcknowledgmentV2ByAckId = asyncHandler(async (req, res) => {
  const data = await acknoledgementService.getAcknowledgmentV2ByAckId(req.params.ackId);
  res.status(200).json({ success: true, data, message: "Acknowledgment V2 fetched successfully" });
});

const updateAcknowledgmentV2 = asyncHandler(async (req, res) => {
  const data = await acknoledgementService.updateAcknowledgmentV2(req.body);
  res.status(200).json({ success: true, data, message: "Acknowledgment V2 updated successfully" });
});

module.exports = {
  createAcknowledgment,
  updateAcknowledgment,
  createAcknowledgmentV2,
  getAcknowledgmentV2ByAckId,
  updateAcknowledgmentV2
};
