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
  breakdownIds: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  }],
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  breakdownSnapshots: {
    type: [mongoose.Schema.Types.Mixed],
    required: true,
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
