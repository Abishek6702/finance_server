// model.receiptCounter.js
const mongoose = require("mongoose");

const receiptCounterSchema = new mongoose.Schema({
  date: {
    type: String, // YYYYMMDD
    required: true,
    unique: true
  },
  sequence: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model("ReceiptCounter", receiptCounterSchema);