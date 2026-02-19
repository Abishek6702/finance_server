const mongoose=require("mongoose");


/* ======================================================
   AMOUNT STRUCTURE
====================================================== */

const amountSchema=new mongoose.Schema({
  total:{type:Number,default:0,min:0},
  paid:{type:Number,default:0,min:0},
  status:{
    type:String,
    enum:["Paid","Partially Paid","Unpaid"],
    default:"Unpaid"
  }
},{_id:false});


/* ======================================================
   SEMESTER LEDGER
====================================================== */

const semesterLedgerSchema=new mongoose.Schema({
  semesterNumber:{type:Number,min:1,max:8},
  tuition:{type:amountSchema,default:()=>({})},
  exam:{type:amountSchema,default:()=>({})},
  erp:{type:amountSchema,default:()=>({})},
  book:{type:amountSchema,default:()=>({})},
  lab:{type:amountSchema,default:()=>({})},
  subTotal:{type:Number,default:0},
  specialConcession:{type:Number,default:0},
  total:{type:amountSchema,default:()=>({})}
},{_id:false});


/* ======================================================
   TRANSPORT LEDGER
====================================================== */

const transportLedgerSchema=new mongoose.Schema({
  route:String,
  stopName:String,
  distanceKM:Number,
  subTotal:{type:Number,default:0},
  specialConcession:{type:Number,default:0},
  total:{type:amountSchema,default:()=>({})}
},{_id:false});


/* ======================================================
   HOSTEL LEDGER
====================================================== */

const hostelLedgerSchema=new mongoose.Schema({
  block:String,
  roomType:{
    sharingType:String,
    isAttached:Boolean
  },
  roomFee:{type:amountSchema,default:()=>({})},
  messFee:{type:amountSchema,default:()=>({})},
  maintenanceFee:{type:amountSchema,default:()=>({})},
  subTotal:{type:Number,default:0},
  specialConcession:{type:Number,default:0},
  total:{type:amountSchema,default:()=>({})}
},{_id:false});


/* ======================================================
   CONCESSIONS (YEAR LEVEL)
====================================================== */

const concessionSchema=new mongoose.Schema({
  firstGraduate:{type:Number,default:0},
  scheme7point5:{type:Number,default:0},
  pmss:{type:Number,default:0},
  sakthi:{type:Number,default:0},
  totalConcession:{type:Number,default:0}
},{_id:false});


/* ======================================================
   ACADEMIC YEAR WISE RECORD
====================================================== */

const academicYearWiseRecordSchema=new mongoose.Schema({
  academicYear:{
    type:String,
    trim:true,
    match:/^\d{4}-\d{4}$/,
    index:true
  },
  academic:{
    odd:semesterLedgerSchema,
    even:semesterLedgerSchema,
    subTotal:{type:Number,default:0},
    total:{type:amountSchema,default:()=>({})}
  },
  transport:transportLedgerSchema,
  hostel:hostelLedgerSchema,
  concessions:concessionSchema,
  total:{type:amountSchema,default:()=>({})}
},{_id:false});


/* ======================================================
   MAIN TRACKING DOCUMENT
====================================================== */

const studentFeeTrackingSchema=new mongoose.Schema({
  student:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Student",
    required:true,
    unique:true,
    index:true
  },
  rollNo:{type:String,index:true},
  academicYearWiseRecord:[academicYearWiseRecordSchema]
},{timestamps:true});


/* ======================================================
   EXPORT
====================================================== */

module.exports=mongoose.model("StudentFeeTracking",studentFeeTrackingSchema);
