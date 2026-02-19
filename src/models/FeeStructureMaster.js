const mongoose=require("mongoose");
const enqueueLedgerRebuild=require("../utils/enqueueLedgerRebuild");


/* ======================================================
   BASIC FEE
====================================================== */

const feeSchema=new mongoose.Schema({
  fee:{type:Number,min:0,default:0}
},{_id:false});


/* ======================================================
   SEMESTER
====================================================== */

const semesterWiseFeeSchema=new mongoose.Schema({
  semesterNumber:{type:Number,required:true,min:1,max:8},
  tuition:feeSchema,
  exam:feeSchema,
  erp:feeSchema,
  book:feeSchema,
  lab:feeSchema,
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{_id:false});


/* ======================================================
   DEPARTMENT
====================================================== */

const departmentWiseFeeSchema=new mongoose.Schema({
  departmentName:{type:String,required:true,trim:true,uppercase:true},
  semesters:{type:[semesterWiseFeeSchema],default:[]},
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{_id:false});


/* ======================================================
   ACADEMIC STRUCTURE
====================================================== */

const academicFeeSchema=new mongoose.Schema({
  quota:{type:String,enum:["Management Quota","Government Quota"],required:true},
  educationType:{type:String,enum:["UG","PG"],required:true},
  degreeProgram:{type:String,enum:["BE","BTech","ME","MTech"],required:true},
  departments:[departmentWiseFeeSchema],
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{_id:false});


/* ======================================================
   TRANSPORT
====================================================== */

const transportSchema=new mongoose.Schema({
  route:{type:String,trim:true,default:null},
  stopName:{type:String,trim:true},
  distanceKM:{type:Number,min:0},
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{_id:false});


/* ======================================================
   HOSTEL
====================================================== */

const hostelSchema=new mongoose.Schema({
  block:{type:String,trim:true,uppercase:true},
  roomType:{
    sharingType:{type:String,enum:["Two","Three","Four","Five"]},
    isAttached:{type:Boolean,default:false}
  },
  roomFee:feeSchema,
  messFee:feeSchema,
  maintenanceFee:feeSchema,
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{_id:false});


/* ======================================================
   MASTER STRUCTURE
====================================================== */

const feeStructureMasterSchema=new mongoose.Schema({
  academicYear:{
    type:String,
    required:true,
    unique:true,
    trim:true,
    match:/^\d{4}-\d{4}$/
  },
  academicStructures:[academicFeeSchema],
  transportStructures:[transportSchema],
  hostelStructures:[hostelSchema],
  total:feeSchema,
  isActive:{type:Boolean,default:true}
},{timestamps:true});


/* ======================================================
   TOTAL UTILITIES
====================================================== */

const sum=arr=>(arr||[]).reduce((a,b)=>a+(b?.fee||0),0);

function ensureTotal(obj){
  if(!obj.total) obj.total={fee:0};
}


/* ======================================================
   AUTO TOTAL CALCULATIONS
====================================================== */

semesterWiseFeeSchema.pre("validate",function(next){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return next(); }
  this.total.fee=sum([this.tuition,this.exam,this.erp,this.book,this.lab]);
  next();
});

departmentWiseFeeSchema.pre("validate",function(next){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return next(); }
  this.total.fee=sum(this.semesters.filter(s=>s.isActive).map(s=>s.total));
  next();
});

academicFeeSchema.pre("validate",function(next){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return next(); }
  this.total.fee=sum(this.departments.filter(d=>d.isActive).map(d=>d.total));
  next();
});

hostelSchema.pre("validate",function(next){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return next(); }
  this.total.fee=sum([this.roomFee,this.messFee,this.maintenanceFee]);
  next();
});

feeStructureMasterSchema.pre("validate",function(next){
  ensureTotal(this);

  const academicTotals =this.academicStructures.filter(a=>a.isActive).map(a=>a.total);
  const transportTotals=this.transportStructures.filter(t=>t.isActive).map(t=>t.total);
  const hostelTotals   =this.hostelStructures.filter(h=>h.isActive).map(h=>h.total);

  this.total.fee=sum([...academicTotals,...transportTotals,...hostelTotals]);
  next();
});


/* ======================================================
   LEDGER REBUILD TRIGGERS
====================================================== */

feeStructureMasterSchema.post("findOneAndUpdate",async function(doc){
  if(doc) enqueueLedgerRebuild(doc);
});

feeStructureMasterSchema.post("save",async function(doc){
  if(!doc.$locals?.skipRebuild) enqueueLedgerRebuild(doc);
});


/* ======================================================
   EXPORT
====================================================== */

module.exports=mongoose.model("FeeStructureMaster",feeStructureMasterSchema);
