const mongoose = require("mongoose");

const receiptRecallSchema = new mongoose.Schema({
  receiptId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  receiptNo: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  rollNo: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  feeHeadIds: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  }],
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  feeHeadSnapshots: {
    type: [mongoose.Schema.Types.Mixed],
    required: true,
  },
  paymentType: {
    type: String,
    enum: ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD"],
    required: true,
  },
  bankName: { type: String, trim: true, default: null },
  bankLocation: { type: String, trim: true, default: null },
  billingDate: { type: Date, default: null },
  remarks: { type: String, trim: true, default: null },
  totalAmount: { type: Number, default: 0 },
  studentInfo: {
    studentName: { type: String, trim: true, default: null },
    studentPhoto: { type: String, trim: true, default: null },
    departmentName: { type: String, trim: true, default: null },
    section: { type: String, trim: true, default: null },
    currentAcademicYear: { type: String, trim: true, default: null },
    yearStudying: { type: Number, default: null },
    currentSemesterNumber: { type: Number, default: null },
  },
  recalledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

// Compound index for fast lookups
receiptRecallSchema.index({ receiptNo: 1, rollNo: 1 });

module.exports = mongoose.model("ReceiptRecallRequest", receiptRecallSchema);
