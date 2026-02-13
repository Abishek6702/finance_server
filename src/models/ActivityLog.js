const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  endpoint: String,
  method: String,
  module: String,
  description: String,
  before: Object,
  after: Object,
  meta: {
    email: { type: String },     
    status: { type: String }, 
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
