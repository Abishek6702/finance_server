const asyncHandler = require("../../../utils/asyncHandler");
const reportService = require("./serviceReports");

exports.getIndividualReport = asyncHandler(async (req, res, next) => {
  const result = await reportService.generateIndividualReport(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Individual fee report fetched successfully",
  });
});

exports.getDatewiseReport = asyncHandler(async (req, res, next) => {
  const result = await reportService.generateDatewiseReport(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Date wise fee report fetched successfully",
  });
});

exports.getClasswiseReport = asyncHandler(async (req, res, next) => {
  const result = await reportService.generateClasswiseReport(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Class wise fee report fetched successfully",
  });
});

exports.getCumulativeBalanceHistoryReport = asyncHandler(async (req, res, next) => {
  const result = await reportService.generateCumulativeBalanceHistoryReport(req.query);

  res.status(200).json({
    success: true,
    data: result,
    message: "Cumulative balance history report fetched successfully",
  });
});
