const facilityService = require("./serviceStudentFacility");
const asyncHandler = require("../../../utils/asyncHandler");
const mongoose = require("mongoose");

const assignFacility = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await facilityService.assignFacility(rollNo, req.body, session);
    });
  } finally {
    session.endSession();
  }

  const { student, message } = result;
  res.status(200).json({ success: true, data: { student }, message });
});

const cancelFacility = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const session = await mongoose.startSession();

  let data;

  try {
    await session.withTransaction(async () => {
      data = await facilityService.cancelFacility(
        rollNo,
        { ...req.body, idempotencyKey: req.headers["x-idempotency-key"] },
        req.user._id,
        session
      );
    });
  } finally {
    session.endSession();
  }

  res.status(200).json({
    success: true,
    data,
    message: "Facility cancelled successfully"
  });
});

module.exports = { assignFacility, cancelFacility };
