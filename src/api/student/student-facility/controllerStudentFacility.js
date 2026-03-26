const facilityService = require("./serviceStudentFacility");
const asyncHandler = require("../../../utils/asyncHandler");

const assignFacility = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const { student, message } = await facilityService.assignFacility(rollNo, req.body);
  res.status(200).json({ success: true, data: { student }, message });
});

const cancelFacility = asyncHandler(async (req, res, next) => {
  const { rollNo } = req.params;
  const data = await facilityService.cancelFacility(
    rollNo,
    { ...req.body, idempotencyKey: req.headers["x-idempotency-key"] },
    req.user._id
  );

  res.status(200).json({
    success: true,
    data,
    message: "Facility cancelled successfully"
  });
});

module.exports = { assignFacility, cancelFacility };
