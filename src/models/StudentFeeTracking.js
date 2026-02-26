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
  total:{type:amountSchema,default:()=>({})}
},{_id:false});


/* ======================================================
   TRANSPORT LEDGER
====================================================== */

const transportLedgerSchema=new mongoose.Schema({
  transport:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"Transport"
    },
  subTotal:{type:Number,default:0},
  transportSpecialConcession:{type:Number,default:0},
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
  hostelSpecialConcession:{type:Number,default:0},
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
    academicSpecialConcession:{type:Number,default:0},
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
   PRE-SAVE MIDDLEWARE: ENFORCE ACADEMIC TOTAL CALCULATION
====================================================== */
studentFeeTrackingSchema.pre("save",function(next){

  this.academicYearWiseRecord?.forEach(yearRecord=>{
    const academic=yearRecord.academic;
    if(!academic) return;

    const subTotal=academic.subTotal||0;
    const concession=academic.academicSpecialConcession||0;

    const payable=Math.max(0,subTotal-concession);

    academic.total=academic.total||{};
    academic.total.total=payable;

    // prevent overpayment
    academic.total.paid=Math.min(academic.total.paid||0,payable);

    const paid=academic.total.paid;

    if(payable===0) academic.total.status="Paid";
    else if(paid>=payable) academic.total.status="Paid";
    else if(paid>0) academic.total.status="Partially Paid";
    else academic.total.status="Unpaid";
  });

  next();
});


/* ======================================================
   EXPORT
====================================================== */

module.exports=mongoose.model("StudentFeeTracking",studentFeeTrackingSchema);
