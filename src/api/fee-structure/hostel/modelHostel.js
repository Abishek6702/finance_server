const mongoose = require("mongoose");

const hostelSchema = new mongoose.Schema({
  block: {
    type: String,
    enum: ["A", "B", "C", "D", "E", "F"],
    required: true,
    uppercase: true,
    trim: true
  },
  sharing: {
    type: Number,
    enum: [2, 3, 4, 5],
    required: true
  },
  isAttached: {
    type: Boolean,
    required: true
  },
  fee: {
    type: Number,
    required: true,
    min: 0
  }
});

/* ------------------------------------------------
   Prevent duplicate hostel configurations
------------------------------------------------ */

hostelSchema.index(
  { block: 1, sharing: 1, isAttached: 1 },
  { unique: true }
);

const Hostel = mongoose.model("Hostel", hostelSchema);

module.exports = { Hostel };