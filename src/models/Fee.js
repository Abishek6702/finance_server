const mongoose=require("mongoose");


// ---------- COMMON SUB SCHEMAS ----------

const semesterWiseFeeSchema=new mongoose.Schema({

  semesterNumber:{
    type:Number,
    required:true,
    min:1,
    max:8
  },

  tuitionFee:{type:Number,required:true,min:0},
  examFee:{type:Number,required:true,min:0},
  erpFee:{type:Number,required:true,min:0},
  bookFee:{type:Number,required:true,min:0},
  labFee:{type:Number,required:true,min:0},

  totalFee:{type:Number,min:0},
  
  isActive:{type:Boolean,default:true}

},{_id:false});


// auto total calculation
semesterWiseFeeSchema.pre("validate",function(next){
  this.totalFee=
    this.tuitionFee+
    this.examFee+
    this.erpFee+
    this.bookFee+
    this.labFee;
  next();
});



const departmentWiseFeeSchema=new mongoose.Schema({

  department:{
    type:String,
    required:true,
    trim:true,
    uppercase:true
  },

  semesters:{
    type:[semesterWiseFeeSchema], 
  },
  
  isActive:{type:Boolean,default:true}

},{_id:false});



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

  departments:{
    type:[departmentWiseFeeSchema], 
  },

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- TRANSPORT ----------

const transportSchema=new mongoose.Schema({

  route:{type:String,trim:true,default:""},

  stopName:{
    type:String,
    required:true,
    trim:true
  },

  distanceKM:{
    type:Number,
    required:true,
    min:0
  },

  fee:{
    type:Number,
    required:true,
    min:0
  },

  isActive:{type:Boolean,default:true}

},{_id:false});



// ---------- HOSTEL ----------

const hostelSchema=new mongoose.Schema({

  block:{
    type:String,
    required:true,
    trim:true,
    uppercase:true
  },

  roomType:{
    sharingType:{
      type:String,
      enum:["Two","Three","Four","Five"],
      required:true
    },
    isAttached:{type:Boolean,default:false}
  },

  roomFee:{type:Number,default:0,min:0},
  messFee:{type:Number,default:0,min:0},
  maintenanceFee:{type:Number,default:0,min:0},

  totalFee:{type:Number,min:0},

  isActive:{type:Boolean,default:true}

},{_id:false});


// auto hostel total
hostelSchema.pre("validate",function(next){
  this.totalFee=this.roomFee+this.messFee+this.maintenanceFee;
  next();
});



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

  notes:{type:String,trim:true,maxlength:300},

  
  isActive:{type:Boolean,default:true}


},{timestamps:true});


// ---------- INDEXES FOR PERFORMANCE ----------

feeStructureMasterSchema.index({"tuitionStructures.degreeProgram":1});
feeStructureMasterSchema.index({"tuitionStructures.departments.department":1});
feeStructureMasterSchema.index({"transportStructures.stopName":1});
feeStructureMasterSchema.index({"hostelStructures.block":1});


module.exports=mongoose.model(
  "FeeStructureMaster",
  feeStructureMasterSchema
);
