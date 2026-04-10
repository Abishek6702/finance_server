const asyncHandler = require("../../utils/asyncHandler");
const dashboardService = require("./serviceDashboard");

exports.getStudentsCount = asyncHandler(async (req, res) => {
  const result = await dashboardService.getStudentsCount(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Students count fetched successfully",
  });
});

exports.getDepartmentDistribution = asyncHandler(async (req, res) => {
  const result = await dashboardService.getDepartmentDistribution(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Department distribution fetched successfully",
  });
});

exports.getFeesStatus = asyncHandler(async (req, res) => {
  const result = await dashboardService.getFeesStatus(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Department fee status fetched successfully",
  });
});
