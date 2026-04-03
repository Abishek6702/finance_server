const mongoose=require("mongoose");

const feeHeadSchema=new mongoose.Schema({
  type:{
    type:String,
    enum:["tuition","exam","erp","book","lab","hostel","transport"],
    required:true
  },
  fee:{type:Number,default:0}
},{_id:true});

const paymentBreakdownSchema=new mongoose.Schema({
  academicYear:{
    type:String,
    required:true,
    match:/^\d{4}-\d{4}$/
  },
  semesterNumber:{type:Number,min:1,max:8,default:null},
  feeHeads:{type:[feeHeadSchema],default:[]},
  total:{type:Number,default:0}
});

const paymentRecordSchema=new mongoose.Schema({
  receiptNo:{
    type:String,
    required:true,
    trim:true
  },
  status:{
    type:String,
    enum:["RECEIVED","SUCCESSFUL","REJECTED"],
    default:"RECEIVED"
  },
  paymentType:{
    type:String,
    enum:["Cash","Card","UPI","NetBanking","Cheque","DD","excessAmount","reduction"],
    required:true
  },
  bankName:{type:String,trim:true,default:null},
  bankLocation:{type:String,trim:true,default:null},
  reductionId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"StudentFacilityTransfer",
    default:null
  },
  billingDate:{type:Date,default:Date.now},
  paidOn:{type:Date,default:Date.now},
  excessAmount:{type:Number,default:0},
  breakdowns:{type:[paymentBreakdownSchema],default:[]},
  totalAmount:{type:Number,default:0}
},{timestamps:true});

const studentacknoledgementSchema=new mongoose.Schema({
  student:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Student",
    required:true,
    unique:true,
    index:true
  },
  rollNo:{type:String,index:true},
  acknoledgements:{type:[paymentRecordSchema],default:[]}
},{timestamps:true});

const acknoledgementV2Schema = new mongoose.Schema(
  {
    ackId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    rollNo: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    paymentType: {
      type: String,
      enum: ["Cash", "Card", "UPI", "NetBanking", "Cheque", "DD", "excessAmount", "reduction"],
      required: true,
    },
    bankName: {
      type: String,
      trim: true,
      default: null,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["RECEIVED", "SUCCESSFUL", "REJECTED"],
      default: "RECEIVED",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    message: {
      type: String,
      trim: true,
      default: "Acknowledgment received",
    },
  },
  { timestamps: true }
);

paymentRecordSchema.pre("validate",async function(){
  if (this.totalAmount === undefined || this.totalAmount === null || this.totalAmount === 0) {
    this.totalAmount=this.breakdowns.reduce((sum,b)=>sum+(b.total||0),0);
  }
});

const Studentacknoledgement = mongoose.model("Studentacknoledgement", studentacknoledgementSchema);
const StudentacknoledgementV2 = mongoose.model("StudentacknoledgementV2", acknoledgementV2Schema);

module.exports = Studentacknoledgement;
module.exports.StudentacknoledgementV2 = StudentacknoledgementV2;
