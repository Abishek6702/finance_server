const facilityService = require("./service.StudentFacilityManagement");
const asyncHandler = require("../../utils/asyncHandler");

const updateFacility = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const { student, message } = await facilityService.updateFacility(rollNo, req.body);
  res.status(200).json({ success: true, data: { student }, message });
});

module.exports = { updateFacility };
