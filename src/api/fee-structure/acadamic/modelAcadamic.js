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
const departments=["CSE","IT","AIML","AIDS","ECE","EEE","MECH","CIVIL"];
const departmentWiseFeeSchema=new mongoose.Schema({
  departmentName:{type:String,required:true,enum:departments},
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

function getSemesterTotal(semester){
  return sum([
    semester?.tuition,
    semester?.exam,
    semester?.erp,
    semester?.book,
    semester?.lab,
  ]);
}

function getDepartmentTotal(department){
  return (department?.semesters||[]).reduce((acc,semester)=>{
    if(!semester?.isActive) return acc;
    return acc + getSemesterTotal(semester);
  },0);
}

function getAcademicStructureTotal(structure){
  return (structure?.departments||[]).reduce((acc,department)=>{
    if(!department?.isActive) return acc;
    return acc + getDepartmentTotal(department);
  },0);
}


/* ======================================================
   AUTO TOTAL CALCULATIONS
====================================================== */

semesterWiseFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=getSemesterTotal(this);
});

departmentWiseFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=getDepartmentTotal(this);
});

academicFeeSchema.pre("validate",async function(){
  ensureTotal(this);
  if(!this.isActive){ this.total.fee=0; return; }
  this.total.fee=getAcademicStructureTotal(this);
});

feeStructureMasterSchema.pre("validate",async function(){
  ensureTotal(this);

  this.total.fee=(this.academicStructures||[]).reduce((acc,structure)=>{
    if(!structure?.isActive) return acc;
    return acc + getAcademicStructureTotal(structure);
  },0);
});



/* ======================================================
   EXPORT
====================================================== */

module.exports=mongoose.model("FeeStructureMaster",feeStructureMasterSchema);
