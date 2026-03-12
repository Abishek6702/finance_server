const hostelService = require("./serviceHostel");
const asyncHandler = require("../../../utils/asyncHandler");

const getAllHostels = asyncHandler(async (req, res) => {
  const data = await hostelService.getAllHostels();
  res.status(200).json({
    success: true,
    data,
    message: "Hostel configurations retrieved successfully"
  });
});

const createHostel = asyncHandler(async (req, res) => {
  const data = await hostelService.createHostel(req.body);
  res.status(201).json({
    success: true,
    data,
    message: "Hostel configuration created successfully"
  });
});

const bulkCreateHostels = asyncHandler(async (req, res) => {
  const data = await hostelService.bulkCreateHostels(req.body);
  res.status(201).json({
    success: true,
    data,
    message: `Successfully inserted ${data.length} hostel configurations`
  });
});

const updateHostelConfig = asyncHandler(async (req, res) => {
  const data = await hostelService.updateHostelConfig(req.params.id, req.body);
  res.status(200).json({
    success: true,
    data,
    message: "Hostel configuration updated successfully"
  });
});

const updateHostelFee = asyncHandler(async (req, res) => {
  const data = await hostelService.updateHostelFee(req.params.id, req.body.fee);
  res.status(200).json({
    success: true,
    data,
    message: "Hostel fee updated successfully"
  });
});

const deleteHostel = asyncHandler(async (req, res) => {
  await hostelService.deleteHostel(req.params.id);
  res.status(200).json({
    success: true,
    message: "Hostel configuration deleted successfully"
  });
});

module.exports = { 
  getAllHostels,
  createHostel,
  bulkCreateHostels,
  updateHostelConfig,
  updateHostelFee,
  deleteHostel
};
