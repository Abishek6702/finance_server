const trackingService = require("./serviceStudentFeeTracking");
const asyncHandler = require("../../../utils/asyncHandler");

const getStudentsFeeTrackingData = asyncHandler(async (req, res) => { 
  
  const data = await trackingService.getStudentsFeeTrackingData(req.query);
  if (data.length === 0) {
    return res.status(200).json({ success: true, data: [], message: "No student fee tracking data found" });
  }
  res.status(200).json({ success: true, data, message: "Student fee tracking data fetched successfully" });
});

const getStudentsFeeTrackingData2 = asyncHandler(async (req, res) => {
  const data = await trackingService.getStudentsFeeTrackingData2(req.query);
  if (data.length === 0) {
    return res.status(200).json({ success: true, data: [], message: "No student fee tracking data found" });
  }
  res.status(200).json({ success: true, data, message: "Student fee tracking data fetched successfully" });
});


const backfillAllStudentFeeTracking = asyncHandler(async (req, res) => {
  const data = await trackingService.backfillAllStudentFeeTracking();
  res.status(200).json({
    success: true,
    data,
    message: "Student fee tracking backfill completed successfully"
  });
});

const triggerFeeTrackingUpdate = asyncHandler(async (req, res) => {
  const data = await trackingService.triggerFeeTrackingUpdate(req.body);
  res.status(200).json({
    success: true,
    data,
    message: "Fee tracking updated successfully based on fee structure"
  });
});

const triggerPromotionForAcademicYear = asyncHandler(async (req, res) => {
  const data = await trackingService.triggerPromotionForAcademicYear(req.body);
  res.status(200).json({
    success: true,
    data,
    message: "Students promoted successfully"
  });
});

const triggerDepromotionForAcademicYear = asyncHandler(async (req, res) => {
  const data = await trackingService.triggerDepromotionForAcademicYear(req.body);
  res.status(200).json({
    success: true,
    data,
    message: "Students depromoted successfully"
  });
});

module.exports = {
  getStudentsFeeTrackingData,
  getStudentsFeeTrackingData2,
  backfillAllStudentFeeTracking,
  triggerFeeTrackingUpdate,
  triggerPromotionForAcademicYear,
  triggerDepromotionForAcademicYear,
};
