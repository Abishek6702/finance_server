const trackingService = require("./service.studentFeeTracking");
const asyncHandler = require("../../utils/asyncHandler");

const getStudents = asyncHandler(async (req, res) => {
  const data = await trackingService.getStudents(req.query);
  res.status(200).json({ success: true, data, message: "Student fee tracking data fetched successfully" });
});

module.exports = { getStudents };

