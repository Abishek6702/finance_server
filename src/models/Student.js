const mongoose=require("mongoose");
const generateLedger=require("../utils/generateLedger");


/* ======================================================
   PERSONAL
====================================================== */

const personalSchema=new mongoose.Schema({
  rollNo:{
    type:String,
    required:true,
    unique:true,
    uppercase:true,
    trim:true,
    match:[/^\d{2}[A-Z]{2}\d{3}$/,"Invalid roll number format"]
  },
  studentName:{type:String,trim:true},
  gender:{type:String,enum:["Male","Female","Other"]},
  dob:Date,
  bloodGroup:{type:String,enum:["A+","A-","B+","B-","AB+","AB-","O+","O-"]},
  aadharNo:{type:String,trim:true,match:/^\d{12}$/},
  emisNo:{type:String,trim:true},
  religion:{type:String,trim:true},
  community:{type:String,trim:true,maxlength:50},
  casteName:{type:String,trim:true,maxlength:50},
  nationality:{type:String,trim:true},
  studentPhoto:{type:String,trim:true}
},{_id:false});


/* ======================================================
   ACADEMIC
====================================================== */

const academicSchema=new mongoose.Schema({
  educationType:{type:String,enum:["UG","PG"]},
  academicType:{type:String,enum:["REG","PART_TIME"]},
  isLateralEntry:{type:Boolean,default:false},
  departmentName:{type:String,trim:true,uppercase:true},
  degreeProgram:{type:String,enum:["BE","BTech","ME","MTech"],required:true},
  yearStudying:{type:Number,enum:[1,2,3,4]},
  currentSemesterNumber:{type:Number,enum:[1,2,3,4,5,6,7,8]},
  section:{type:String,enum:["A","B","C","D","E","F"],uppercase:true,default:null},
  batch:{type:String,required:true,trim:true,match:/^\d{4}-\d{4}$/},
  currentAcademicYear:{type:String,required:true,trim:true,match:/^\d{4}-\d{4}$/}
},{_id:false});


/* ======================================================
   CONTACT
====================================================== */

const contactSchema=new mongoose.Schema({
  selfMobileNo:{type:String,trim:true,match:/^[6-9]\d{9}$/},
  selfEmail:{type:String,trim:true,lowercase:true,match:/^\S+@\S+\.\S+$/},
  officialEmail:{type:String,trim:true,lowercase:true,match:/^[a-z0-9._%+-]+@sece\.ac\.in$/}
},{_id:false});


/* ======================================================
   FAMILY
====================================================== */

const familySchema=new mongoose.Schema({
  father:{name:String,mobile:String,workType:String,qualification:String},
  mother:{name:String,mobile:String,workType:String,qualification:String},
  guardian:{name:String,mobile:String},
  familyIncomeAsPerCertificate:{type:Number,min:0},
  communityCertificateNo:String
},{_id:false});


/* ======================================================
   ADDRESS
====================================================== */

const addressSchema=new mongoose.Schema({
  permanent:{doorNo:String,street:String,taluk:String,district:String,state:String,pincode:String},
  communication:{doorNo:String,street:String,taluk:String,district:String,state:String,pincode:String}
},{_id:false});


/* ======================================================
   ENROLLMENT
====================================================== */

const enrollmentSchema=new mongoose.Schema({
  quota:{type:String,enum:["Management Quota","Government Quota"]},

  firstGraduate:{
    isApplicable:{type:Boolean,default:false},
    concessionAmount:{type:Number,default:0}
  },

  scheme7point5:{
    isApplicable:{type:Boolean,default:false},
    concessionAmount:{type:Number,default:0}
  },

  pmssScheme:{
    isApplicable:{type:Boolean,default:false},
    concessionAmount:{type:Number,default:0}
  },

  sakthiScheme:{
    isApplicable:{type:Boolean,default:false},
    concessionAmount:{type:Number,default:0}
  },

  specialConcession:{
    isApplicable:{type:Boolean,default:false},
    transport:{type:Number,default:0},
    hostel:{type:Number,default:0},
    tuition:{type:Number,default:0}
  }

},{_id:false});


/* ======================================================
   TRANSPORT
====================================================== */

const transportSchema=new mongoose.Schema({
  isApplicable:{type:Boolean,default:false},
  route:{type:String,trim:true},
  stopName:{type:String,trim:true},
  distanceKM:{type:Number,min:0}
},{_id:false});


/* ======================================================
   HOSTEL
====================================================== */

const hostelSchema=new mongoose.Schema({
  isApplicable:{type:Boolean,default:false},
  block:{type:String,uppercase:true,trim:true},
  roomType:{
    sharingType:{type:String,enum:["Two","Three","Four","Five"]},
    isAttached:{type:Boolean,default:false}
  }
},{_id:false});


/* ======================================================
   MAIN STUDENT SCHEMA
====================================================== */

const studentSchema=new mongoose.Schema({
  personal:personalSchema,
  academic:academicSchema,
  contact:contactSchema,
  family:familySchema,
  address:addressSchema,
  enrollment:enrollmentSchema,
  transport:transportSchema,
  hostel:hostelSchema
},{timestamps:true});


/* ======================================================
   AUTO GENERATE FEE LEDGER
====================================================== */

studentSchema.pre("save",function(next){
  this.$locals.wasNew=this.isNew;
  next();
});

studentSchema.post("save",async function(doc){
  try{

    // prevent regeneration on updates
    if(!doc.$locals?.wasNew) return;

    await generateLedger(doc);

  }catch(err){
    console.error("Ledger generation failed:",err.message);
  }
});


module.exports=mongoose.model("Student",studentSchema);
