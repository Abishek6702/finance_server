dotenv.config();
const express=require("express");
const cookieParser=require("cookie-parser");
const dotenv=require("dotenv");
const connectDB=require("./config/db");
const authRoutes=require("./api/auth/routes");
const feeStructureRoutes=require("./api/feeStructureMaster/routes");
const studentsManagementRoutes=require("./api/studentsManagement/routes");
const feePaymentRoutes=require("./api/feePayment/routes");
const transportRoutes=require("./api/transport/routes");
const corsMiddleware=require("./middleware/corsMiddleware");
const {seedTransport}=require("./models/Transport");

 require("./seed");
const app=express();
  
app.use(express.json());
app.use(cookieParser());

app.use(corsMiddleware);

app.use("/api/auth",authRoutes);
app.use("/api/feeStructureMaster",feeStructureRoutes);
app.use("/api/studentsManagement",studentsManagementRoutes);
app.use("/api/feePayment",feePaymentRoutes);
app.use("/api/transport",transportRoutes);
 
app.use("/assets",express.static("public/assets"));
 
app.use((req,res)=>{
  res.status(404).json({message:"Route not found"});
});
 
const PORT= 5010;

connectDB().then(()=>{
  app.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
    seedTransport();  
  }); 
});
