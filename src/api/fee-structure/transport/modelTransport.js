const mongoose = require("mongoose");

const transportSchema = new mongoose.Schema({
  route: { type: String, trim: true, required: true },
  busNo: { type: String, trim: true, required: true },
  stop: { type: String, trim: true, required: true },
  fee: { type: Number, required: true, min: 0 }
});

transportSchema.index({ route: 1, busNo: 1, stop: 1 }, { unique: true });

const Transport = mongoose.model("Transport", transportSchema);

module.exports = { Transport };