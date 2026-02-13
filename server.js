const express=require("express");
const dotenv=require("dotenv");
const connectDB=require("./config/db");
const authRoutes=require("./routes/authRoutes");
const corsMiddleware=require("./middleware/corsMiddleware");

dotenv.config();

const app=express();
  
app.use(express.json());

app.use(corsMiddleware);

app.use("/api/auth",authRoutes);
 
app.use("/assets",express.static("public/assets"));
 
app.use((req,res)=>{
  res.status(404).json({message:"Route not found"});
});
 
const PORT=process.env.PORT||5000;

connectDB().then(()=>{
  app.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
  });
});
