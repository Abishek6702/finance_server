const facilityService = require("./serviceStudentFacility");
const asyncHandler = require("../../../utils/asyncHandler");

const updateFacility = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const { student, message } = await facilityService.updateFacility(rollNo, req.body);
  res.status(200).json({ success: true, data: { student }, message });
});

const removeFacility = asyncHandler(async (req, res, next) => {
  const { rollNo } = req.params;
  const data = await facilityService.removeFacility(
    rollNo,
    { ...req.body, idempotencyKey: req.headers["x-idempotency-key"] },
    req.user._id
  );

  res.status(200).json({
    success: true,
    data,
    message: "Facility removed successfully"
  });
});

module.exports = { updateFacility, removeFacility };
