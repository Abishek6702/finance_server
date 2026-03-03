const mongoose = require("mongoose");

const receiptRecallRequestSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
    default: "PENDING",
    index: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  receiptSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Compound index for fast lookups
receiptRecallRequestSchema.index({ receiptNo: 1, rollNo: 1 });

module.exports = mongoose.model("ReceiptRecallRequest", receiptRecallRequestSchema);
