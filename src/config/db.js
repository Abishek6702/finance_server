const mongoose = require("mongoose");
const { MongoMemoryServer, MongoMemoryReplSet } = require("mongodb-memory-server");

let isConnected = false;
let memoryServer = null;

const isTestRuntime = () => Boolean(process.env.JEST_WORKER_ID);

const connectDB = async () => {
  if (isConnected) return;

  if (isTestRuntime()) {
    if (!memoryServer) {
      memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    }

    await mongoose.connect(memoryServer.getUri(), {
      autoIndex: false,
    });
  } else {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not defined");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
    });
  }

  isConnected = true;

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
  });
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  isConnected = false;

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  isTestRuntime,
};