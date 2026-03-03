const trackingService = require("./service.studentFeeTracking");
const asyncHandler = require("../../utils/asyncHandler");

const getStudentsFeeTrackingData = asyncHandler(async (req, res) => {
  const data = await trackingService.getStudentsFeeTrackingData(req.query);
  if (data.length === 0) {
    return res.status(200).json({ success: true, data: [], message: "No student fee tracking data found" });
  }
  res.status(200).json({ success: true, data, message: "Student fee tracking data fetched successfully" });
});

module.exports = { getStudentsFeeTrackingData };
