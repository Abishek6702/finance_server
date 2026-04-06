const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const { connectDB, disconnectDB, isTestRuntime } = require("./config/db");
const seedUsers = require("./seed");

const authRoutes = require("./api/auth/routesAuth");
const feeStructureRoutes = require("./api/fee-structure/acadamic/routesAcadamic");
const studentsManagementRoutes = require("./api/student/students-management/routesStudents");
const paymentTransactionRoutes = require("./api/fee-payment/payments/routesFeePayments");
const acknoledgementRoutes = require("./api/fee-payment/acknoledgement/routesacknoledgement");
const studentFeeTrackingRoutes = require("./api/fee-payment/student-fee-tracking/routesStudentFeeTracking");
const feeDetailsRoutes = require("./api/fee-payment/feedetails/routesFeedetails");
const feeDemandRoutes = require("./api/fee-payment/fee-demand/routesFeeDemand"); 
const transportRoutes = require("./api/fee-structure/transport/routesTransport");
const hostelRoutes = require("./api/fee-structure/hostel/routesHostel");
const receiptRecallRoutes = require("./api/fee-payment/receipt-recall/routesReceiptRecall");
const refundRoutes = require("./api/fee-payment/refund/routes.refund");
const superadminRoutes = require("./api/superadmin/routesSuperadmin");
const reportsRoutes = require("./api/fee-payment/reports/routesReports");
const studentFacilityRoutes = require("./api/student/student-facility/routesStudentFacility");

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
app.use("/api/feeAcknowledgement", acknoledgementRoutes);
app.use("/api/studentFeeTracking", studentFeeTrackingRoutes);
app.use("/api/feedetails", feeDetailsRoutes);
app.use("/api/feedemands", feeDemandRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/hostel", hostelRoutes);
app.use("/api/receiptRecall", receiptRecallRoutes);
app.use("/api/refund", refundRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/studentFacility", studentFacilityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5010;

const startServer = async () => {
  
  if (server) return server;
  if (isTestRuntime() && initialized) return app;
  initialized = true;

  await connectDB();
console.log("DB connected");

console.log("Seeding users...");
await seedUsers();

console.log("Seeding finished");

  // If running under Jest, DO NOT bind to port
  if (isTestRuntime()) {
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

  await disconnectDB();
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Startup failed:", err.message);
    process.exit(1);
  });
}

module.exports = { app, startServer, stopServer };