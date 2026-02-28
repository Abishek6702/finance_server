const express=require("express");
const cookieParser=require("cookie-parser");
const dotenv=require("dotenv");
const mongoose=require("mongoose");
dotenv.config();
const connectDB=require("./config/db");
const authRoutes=require("./api/auth/routes.auth");
const feeStructureRoutes=require("./api/feeStructure/routes.feeStructure");
const studentsManagementRoutes=require("./api/students/routes.students");
const paymentTransactionRoutes=require("./api/transaction/routes.transaction");
const studentFeeTrackingRoutes=require("./api/studentFeeTracking/routes.studentFeeTracking");
const transportRoutes=require("./api/transport/routes.transport");
const hostelRoutes=require("./api/hostel/routes.hostel");
const corsMiddleware=require("./middleware/corsMiddleware");
const {seedTransport}=require("./api/transport/model.transport");
const {seedHostel}=require("./api/hostel/model.hostel");
const seedUsers=require("./seed");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app=express();
let server=null;
  
app.use(express.json());
app.use(cookieParser());

app.use(corsMiddleware);

app.use("/api/auth",authRoutes);
app.use("/api/feeStructureMaster",feeStructureRoutes);
app.use("/api/studentsManagement",studentsManagementRoutes);
app.use("/api/feePayment",studentFeeTrackingRoutes);
app.use("/api/feePayment",paymentTransactionRoutes);
app.use("/api/studentFeeTracking",studentFeeTrackingRoutes);
app.use("/api/transport",transportRoutes);
app.use("/api/hostel",hostelRoutes);
 
app.use("/assets",express.static("public/assets"));
 
app.use(notFoundHandler);
app.use(errorHandler);
 
const PORT= 5010;

const startServer=async()=>{
  if(server) return server;

  await connectDB();
  await seedUsers({ ensureDbConnection: false });

  server=app.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
    seedTransport();
    seedHostel();
  });

  return server;
};

const stopServer=async()=>{
  if(server){
    await new Promise((resolve,reject)=>{
      server.close((error)=>{
        if(error) return reject(error);
        resolve();
      });
    });
    server=null;
  }

  if(mongoose.connection.readyState!==0){
    await mongoose.connection.close();
  }
};

if(require.main===module){
  startServer();
}

module.exports={app,startServer,stopServer};
