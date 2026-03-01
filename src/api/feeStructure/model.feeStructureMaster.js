const mongoose=require("mongoose"); 
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
const dpartments=["CSE","IT","AIML","AIDS","ECE","EEE","MECH","CIVIL"];
const departmentWiseFeeSchema=new mongoose.Schema({
  departmentName:{type:String,required:true,enum:dpartments},
  semesters:{type:[semesterWiseFeeSchema],
  validate:arr=>arr.length==8 ,
  required:true
},
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

semesterWiseFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=sum([this.tuition,this.exam,this.erp,this.book,this.lab]);
});

departmentWiseFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=sum(this.semesters.filter(s=>s.isActive).map(s=>s.total));
});

academicFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=sum(this.departments.filter(d=>d.isActive).map(d=>d.total));
});

hostelSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=sum([this.roomFee,this.messFee,this.maintenanceFee]);
});

feeStructureMasterSchema.pre("validate",async function(){
  ensureTotal(this);

  const academicTotals =this.academicStructures.filter(a=>a.isActive).map(a=>a.total);
  const hostelTotals   =this.hostelStructures.filter(h=>h.isActive).map(h=>h.total);

  this.total.fee=sum([...academicTotals,...hostelTotals]);
});



/* ======================================================
   EXPORT
====================================================== */

module.exports=mongoose.model("FeeStructureMaster",feeStructureMasterSchema);
