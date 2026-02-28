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

hostelSchema.index({ block: 1, sharing: 1, isAttached: 1 }, { unique: true });

const Hostel = mongoose.model("Hostel", hostelSchema);

/*******************************************************/

const data = [
  // A Block
  { block: "A", sharing: 2, isAttached: true, fee: 80000 },
  { block: "A", sharing: 2, isAttached: false, fee: 75000 },
  { block: "A", sharing: 3, isAttached: true, fee: 70000 },
  { block: "A", sharing: 3, isAttached: false, fee: 65000 },
  { block: "A", sharing: 4, isAttached: true, fee: 60000 },
  { block: "A", sharing: 4, isAttached: false, fee: 55000 },
  { block: "A", sharing: 5, isAttached: true, fee: 52000 },
  { block: "A", sharing: 5, isAttached: false, fee: 48000 },
  // B Block
  { block: "B", sharing: 2, isAttached: true, fee: 80000 },
  { block: "B", sharing: 2, isAttached: false, fee: 75000 },
  { block: "B", sharing: 3, isAttached: true, fee: 70000 },
  { block: "B", sharing: 3, isAttached: false, fee: 65000 },
  { block: "B", sharing: 4, isAttached: true, fee: 60000 },
  { block: "B", sharing: 4, isAttached: false, fee: 55000 },
  { block: "B", sharing: 5, isAttached: true, fee: 52000 },
  { block: "B", sharing: 5, isAttached: false, fee: 48000 },
  // C Block
  { block: "C", sharing: 2, isAttached: true, fee: 80000 },
  { block: "C", sharing: 2, isAttached: false, fee: 75000 },
  { block: "C", sharing: 3, isAttached: true, fee: 70000 },
  { block: "C", sharing: 3, isAttached: false, fee: 65000 },
  { block: "C", sharing: 4, isAttached: true, fee: 60000 },
  { block: "C", sharing: 4, isAttached: false, fee: 55000 },
  { block: "C", sharing: 5, isAttached: true, fee: 52000 },
  { block: "C", sharing: 5, isAttached: false, fee: 48000 },
  // D Block
  { block: "D", sharing: 2, isAttached: true, fee: 80000 },
  { block: "D", sharing: 2, isAttached: false, fee: 75000 },
  { block: "D", sharing: 3, isAttached: true, fee: 70000 },
  { block: "D", sharing: 3, isAttached: false, fee: 65000 },
  { block: "D", sharing: 4, isAttached: true, fee: 60000 },
  { block: "D", sharing: 4, isAttached: false, fee: 55000 },
  { block: "D", sharing: 5, isAttached: true, fee: 52000 },
  { block: "D", sharing: 5, isAttached: false, fee: 48000 },
  // E Block
  { block: "E", sharing: 2, isAttached: true, fee: 80000 },
  { block: "E", sharing: 2, isAttached: false, fee: 75000 },
  { block: "E", sharing: 3, isAttached: true, fee: 70000 },
  { block: "E", sharing: 3, isAttached: false, fee: 65000 },
  { block: "E", sharing: 4, isAttached: true, fee: 60000 },
  { block: "E", sharing: 4, isAttached: false, fee: 55000 },
  { block: "E", sharing: 5, isAttached: true, fee: 52000 },
  { block: "E", sharing: 5, isAttached: false, fee: 48000 },
  // F Block
  { block: "F", sharing: 2, isAttached: true, fee: 80000 },
  { block: "F", sharing: 2, isAttached: false, fee: 75000 },
  { block: "F", sharing: 3, isAttached: true, fee: 70000 },
  { block: "F", sharing: 3, isAttached: false, fee: 65000 },
  { block: "F", sharing: 4, isAttached: true, fee: 60000 },
  { block: "F", sharing: 4, isAttached: false, fee: 55000 },
  { block: "F", sharing: 5, isAttached: true, fee: 52000 },
  { block: "F", sharing: 5, isAttached: false, fee: 48000 }
];

//keep it here for High Cohesion
const seedHostel = async () => {
  if (!data.length) return;

  const count = await Hostel.countDocuments();
  if (count > 0) return;

  await Hostel.insertMany(data);
};

module.exports = { Hostel, seedHostel };
