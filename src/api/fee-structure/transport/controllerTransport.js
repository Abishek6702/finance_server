const transportService = require("./serviceTransport");
const asyncHandler = require("../../../utils/asyncHandler");

const getAllTransportStops = asyncHandler(async (req, res) => {
  const data = await transportService.getAllTransportStops(req.query.busNo);
  res.status(200).json({
    success: true,
    data,
    message: "Transport configurations retrieved successfully"
  });
});

const createTransportStop = asyncHandler(async (req, res) => {
  const data = await transportService.createTransportStop(req.body);
  res.status(201).json({
    success: true,
    data,
    message: "Transport stop created successfully"
  });
});

const bulkCreateTransportStops = asyncHandler(async (req, res) => {
  const data = await transportService.bulkCreateTransportStops(req.body);
  res.status(201).json({
    success: true,
    data,
    message: `Successfully inserted ${data.length} transport stops`
  });
});

const updateTransportConfig = asyncHandler(async (req, res) => {
  const data = await transportService.updateTransportConfig(req.params.id, req.body);
  res.status(200).json({
    success: true,
    data,
    message: "Transport configuration updated successfully"
  });
});

const updateTransportFee = asyncHandler(async (req, res) => {
  const data = await transportService.updateTransportFee(req.params.id, req.body.fee);
  res.status(200).json({
    success: true,
    data,
    message: "Transport fee updated successfully"
  });
});

const deleteTransportStop = asyncHandler(async (req, res) => {
  await transportService.deleteTransportStop(req.params.id);
  res.status(200).json({
    success: true,
    message: "Transport stop deleted successfully"
  });
});

module.exports = { 
  getAllTransportStops,
  createTransportStop,
  bulkCreateTransportStops,
  updateTransportConfig,
  updateTransportFee,
  deleteTransportStop
};
