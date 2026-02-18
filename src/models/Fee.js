const mongoose=require("mongoose");


// ---------- TOTAL FEE DETAILS ----------

const feeSchema=new mongoose.Schema({
  totalFee:{type:Number,min:0,default:0},
  paidFee:{type:Number,min:0,default:0},
  status:{
    type:String,
    enum:["Paid","Partially Paid","Unpaid"],
    default:"Unpaid"
  }
},{_id:false});



// ----------- SEMESTER WISE FEE DETAILS ----------

const semesterWiseFeeSchema=new mongoose.Schema({

  semesterNumber:{
    type:Number,
    required:true,
    min:1,
    max:8
  },

  tuition:feeSchema,
  exam:feeSchema,
  erp:feeSchema,
  book:feeSchema,
  lab:feeSchema,

  total:feeSchema,

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- DEPARTMENT ----------

const departmentWiseFeeSchema=new mongoose.Schema({

  department:{
    type:String,
    required:true,
    trim:true,
    uppercase:true
  },

  semesters:{
    type:[semesterWiseFeeSchema],
    default:[]
  },

  total:feeSchema,

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- ACADEMIC STRUCTURE ----------

const academicFeeSchema=new mongoose.Schema({

  quota:{
    type:String,
    enum:["Counselling","Management"],
    required:true
  },

  educationType:{
    type:String,
    enum:["UG","PG"],
    required:true
  },

  degreeProgram:{
    type:String,
    enum:["BE","BTech","ME","MTech"],
    required:true
  },

  departments:[departmentWiseFeeSchema],

  total:feeSchema,

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- TRANSPORT ----------

const transportSchema=new mongoose.Schema({

  route:{type:String,trim:true,default:""},

  stopName:{type:String,trim:true},

  distanceKM:{type:Number,min:0},

  total:feeSchema,

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- HOSTEL ----------

const hostelSchema=new mongoose.Schema({

  block:{type:String,trim:true,uppercase:true},

  roomType:{
    sharingType:{
      type:String,
      enum:["Two","Three","Four","Five"],
      required:true
    },
    isAttached:{type:Boolean,default:false}
  },

  roomFee:feeSchema,
  messFee:feeSchema,
  maintenanceFee:feeSchema,

  total:feeSchema,

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- MASTER FEE STRUCTURE ----------

const feeStructureMasterSchema=new mongoose.Schema({

  academicYear:{
    type:String,
    required:true,
    unique:true,
    trim:true
  },

  tuitionStructures:[academicFeeSchema],

  transportStructures:[transportSchema],

  hostelStructures:[hostelSchema],

  total:feeSchema,

  notes:{type:String,trim:true,maxlength:300},

  isActive:{type:Boolean,default:true}

},{timestamps:true});



/* =========================================================
   ========== 🔽 CALCULATION UTILITIES (BOTTOM) 🔽 ==========
   ========================================================= */

// DRY total calculator
function computeTotals(target,sources){
  let totalFee=0;
  let paidFee=0;

  sources.forEach(src=>{
    totalFee+=src?.totalFee||0;
    paidFee+=src?.paidFee||0;
  });

  target.totalFee=totalFee;
  target.paidFee=paidFee;

  if(paidFee>=totalFee && totalFee>0){
    target.status="Paid";
  }
  else if(paidFee>0){
    target.status="Partially Paid";
  }
  else{
    target.status="Unpaid";
  }
}



/* =========================================================
   ========== 🔽 MIDDLEWARE HOOKS (BOTTOM) 🔽 ==============
   ========================================================= */


// semester total
semesterWiseFeeSchema.pre("validate",function(next){
  computeTotals(this.total,[
    this.tuition,
    this.exam,
    this.erp,
    this.book,
    this.lab
  ]);
  next();
});


// department total
departmentWiseFeeSchema.pre("validate",function(next){
  computeTotals(
    this.total,
    this.semesters.map(s=>s.total)
  );
  next();
});


// academic total
academicFeeSchema.pre("validate",function(next){
  computeTotals(
    this.total,
    this.departments.map(d=>d.total)
  );
  next();
});


// transport status update
transportSchema.pre("validate",function(next){
  computeTotals(this.total,[this.total]);
  next();
});


// hostel total
hostelSchema.pre("validate",function(next){
  computeTotals(this.total,[
    this.roomFee,
    this.messFee,
    this.maintenanceFee
  ]);
  next();
});


// institution total
feeStructureMasterSchema.pre("validate",function(next){

  const academicTotals=this.tuitionStructures.map(a=>a.total);
  const transportTotals=this.transportStructures.map(t=>t.total);
  const hostelTotals=this.hostelStructures.map(h=>h.total);

  computeTotals(
    this.total,
    [...academicTotals,...transportTotals,...hostelTotals]
  );

  next();
});



module.exports=mongoose.model(
  "FeeStructureMaster",
  feeStructureMasterSchema
);
