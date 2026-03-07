const mongoose=require("mongoose");

const paymentBreakdownSchema=new mongoose.Schema({
  academicYear:{
    type:String,
    required:true,
    match:/^\d{4}-\d{4}$/
  },
  academic:{
    semesterNumber:{type:Number,min:1,max:8,default:null},
    tuition:{type:Number,default:0},
    exam:{type:Number,default:0},
    erp:{type:Number,default:0},
    book:{type:Number,default:0},
    lab:{type:Number,default:0}
  },
  hostel:{type:Number,default:0},
  transport:{type:Number,default:0},
  total:{type:Number,default:0}
});

const paymentRecordSchema=new mongoose.Schema({
  receiptNo:{
    type:String,
    required:true,
    trim:true
  },
  paymentType:{
    type:String,
    enum:["Cash","Card","UPI","NetBanking","Cheque","DD"],
    required:true
  },
  bankName:{type:String,trim:true,default:null},
  bankLocation:{type:String,trim:true,default:null},
  billingDate:{type:Date,default:Date.now},
  paidOn:{type:Date,default:Date.now},
  remarks:{type:String,trim:true,default:null},
  breakdowns:{type:[paymentBreakdownSchema],default:[]},
  totalAmount:{type:Number,default:0}
},{timestamps:true});

const studentTransactionSchema=new mongoose.Schema({
  student:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Student",
    required:true,
    unique:true,
    index:true
  },
  rollNo:{type:String,index:true},
  transactions:{type:[paymentRecordSchema],default:[]}
},{timestamps:true});

paymentRecordSchema.pre("validate",async function(){
  this.totalAmount=this.breakdowns.reduce((sum,b)=>sum+(b.total||0),0);
});

module.exports=mongoose.model("StudentTransaction",studentTransactionSchema);
