const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not defined");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false,
  });

  isConnected = true;

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
  });
};

module.exports = connectDB;