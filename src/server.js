const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const connectDB = require("./config/db");
const seedUsers = require("./seed");
const { seedTransport } = require("./api/transport/model.transport");
const { seedHostel } = require("./api/hostel/model.hostel");

const authRoutes = require("./api/auth/routes.auth");
const feeStructureRoutes = require("./api/feeStructure/routes.feeStructure");
const studentsManagementRoutes = require("./api/students/routes.students");
const paymentTransactionRoutes = require("./api/transaction/routes.transaction");
const studentFeeTrackingRoutes = require("./api/studentFeeTracking/routes.studentFeeTracking");
const transportRoutes = require("./api/transport/routes.transport");
const hostelRoutes = require("./api/hostel/routes.hostel");
const receiptRecallRoutes = require("./api/receiptRecall/routes.receiptRecall");
const superadminRoutes = require("./api/superadmin/routes.superadmin");

const corsMiddleware = require("./middleware/corsMiddleware");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();
let server = null;
let initialized = false; // prevents redundant re-seeding in test mode

app.use(express.json());
app.use(corsMiddleware);
app.use("/api/auth", authRoutes);
app.use("/api/feeStructureMaster", feeStructureRoutes);
app.use("/api/studentsManagement", studentsManagementRoutes);
app.use("/api/feePayment", paymentTransactionRoutes);
app.use("/api/studentFeeTracking", studentFeeTrackingRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/hostel", hostelRoutes);
app.use("/api/receiptRecall", receiptRecallRoutes);
app.use("/api/superadmin", superadminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5010;

const startServer = async () => {
  
  if (server) return server;
  if (process.env.NODE_ENV === "test" && initialized) return app;
  initialized = true;

  await connectDB();
console.log("DB connected");

console.log("Seeding users...");
await seedUsers();

console.log("Seeding transport...");
await seedTransport();

console.log("Seeding hostel...");
await seedHostel();

console.log("Seeding finished");

  // If running under Jest, DO NOT bind to port
  if (process.env.NODE_ENV === "test") {
    return app;
  }

  server = await new Promise((resolve) => {
    
    const s = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      resolve(s);
    });
  });

  return server;
};

const stopServer = async () => {
  initialized = false;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, stopServer };