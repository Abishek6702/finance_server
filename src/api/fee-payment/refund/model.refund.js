const mongoose = require("mongoose");

const feeRefundSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      match: /^\d{4}-\d{4}$/,
      trim: true,
    },
    semesterNumber: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },
    feeHead: {
      type: String,
      enum: ["tuition", "exam", "erp", "book", "lab", "hostel", "transport", "excessAmount"],
      required: true,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    refundReceiptNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["completed"],
      default: "completed",
    },
    ledgerIsActive: {
      type: Boolean,
      default: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    collegeAccount: {
      type: String,
      trim: true,
      default: null,
    },
    studentBankName: {
      type: String,
      trim: true,
      default: null,
    },
    studentAccount: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

feeRefundSchema.index({ rollNo: 1, academicYear: 1 });

module.exports = mongoose.model("FeeRefund", feeRefundSchema);
