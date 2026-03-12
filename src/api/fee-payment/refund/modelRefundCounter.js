const mongoose = require("mongoose");

const refundCounterSchema = new mongoose.Schema({
  year: {
    type: String, // YYYY
    required: true,
    unique: true,
  },
  sequence: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("RefundCounter", refundCounterSchema);
