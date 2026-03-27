const mongoose = require("mongoose");

const facilitySnapshotSchema = new mongoose.Schema({
  student: {
    transport: { type: mongoose.Schema.Types.Mixed, default: null },
    hostel: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  tracking: {
    academicYear: { type: String, default: null },
    transport: { type: mongoose.Schema.Types.Mixed, default: null },
    hostel: { type: mongoose.Schema.Types.Mixed, default: null },
    totals: { type: mongoose.Schema.Types.Mixed, default: null },
  },
}, { _id: false });

const studentFacilityTransferSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  rollNo: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  action: {
    type: String,
    enum: ["assign", "cancel", "cancel-assign"],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
    index: true,
  },
  applyFromAcademicYear: {
    type: String,
    match: /^\d{4}-\d{4}$/,
    default: null,
    index: true,
  },
  requestPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 280,
  },
  cancellation: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  assignment: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  settlement: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  reduction: {
    amount: { type: Number, default: 0 },
    paymentReceiptNo: { type: String, default: null },
  },
  previousSnapshot: {
    type: facilitySnapshotSchema,
    default: () => ({}),
  },
  currentSnapshot: {
    type: facilitySnapshotSchema,
    default: () => ({}),
  },
}, { timestamps: true });

module.exports = mongoose.model("StudentFacilityTransfer", studentFacilityTransferSchema);
