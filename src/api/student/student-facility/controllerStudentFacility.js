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

    if (!result) {
      throw new Error("Transaction failed");
    }
  } finally {
    session.endSession();
  }

  const { student, message, facilityTransferId } = result;
  res.status(200).json({
    success: true,
    data: { student, facilityTransferId },
    message,
  });
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

    if (!data) {
      throw new Error("Transaction failed");
    }
  } finally {
    session.endSession();
  }

  res.status(200).json({
    success: true,
    data,
    message: "Facility cancelled successfully"
  });
});

const cancelAndAssign = asyncHandler(async (req, res) => {
  const { rollNo } = req.params;
  const idempotencyKey = req.headers["x-idempotency-key"];
  const session = await mongoose.startSession();

  let data;

  try {
    await session.withTransaction(async () => {
      data = await facilityService.cancelAndAssign(
        rollNo,
        {
          ...req.body,
          idempotencyKey,
        },
        req.user._id,
        session
      );
    });

    if (!data) {
      throw new Error("Transaction failed");
    }
  } finally {
    session.endSession();
  }

  res.status(200).json({
    success: true,
    data,
    message: "Facility cancelled and assigned successfully",
  });
});

const getFacilityTransferById = asyncHandler(async (req, res) => {
  const { transferId } = req.params;
  const data = await facilityService.getFacilityTransferById(transferId);

  res.status(200).json({
    success: true,
    data,
    message: "Facility transfer record fetched successfully",
  });
});

module.exports = { assignFacility, cancelFacility, cancelAndAssign, getFacilityTransferById };
