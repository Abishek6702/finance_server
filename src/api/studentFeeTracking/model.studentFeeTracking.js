const mongoose=require("mongoose");

function normalizeMoney(value){
  const number=Number(value);
  if(!Number.isFinite(number)||number<0) return 0;
  return Math.round(number*100)/100;
}

function normalizeAmountSchema(amount){
  const target=amount||{};

  target.total=normalizeMoney(target.total);
  target.paid=normalizeMoney(target.paid);
  target.paid=Math.min(target.paid,target.total);

  if(target.total===0) target.status="Paid";
  else if(target.paid>=target.total) target.status="Paid";
  else if(target.paid>0) target.status="Partially Paid";
  else target.status="Unpaid";

  return target;
}

const amountSchema=new mongoose.Schema({
  total:{type:Number,default:0,min:0},
  paid:{type:Number,default:0,min:0},
  status:{
    type:String,
    enum:["Paid","Partially Paid","Unpaid"],
    default:"Unpaid"
  }
},{_id:false});

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

const transportLedgerSchema=new mongoose.Schema({
  transport:{
      type:String
    },
  route:{type:String,trim:true},
  busNo:{type:String,trim:true},
  stop:{type:String,trim:true},
  fee:{type:Number,min:0},
  subTotal:{type:Number,default:0},
  transportSpecialConcession:{type:Number,default:0},
  total:{type:amountSchema,default:()=>({})}
},{_id:false});

const hostelLedgerSchema=new mongoose.Schema({
  hostel:{
      type:String
    },
  block:{type:String,trim:true,uppercase:true},
  sharing:{type:Number},
  isAttached:{type:Boolean},
  fee:{type:Number,min:0},
  subTotal:{type:Number,default:0},
  hostelSpecialConcession:{type:Number,default:0},
  total:{type:amountSchema,default:()=>({})}
},{_id:false});

const concessionSchema=new mongoose.Schema({
  firstGraduate:{type:Number,default:0},
  scheme7point5:{type:Number,default:0},
  pmss:{type:Number,default:0},
  sakthi:{type:Number,default:0},
  totalConcession:{type:Number,default:0}
},{_id:false});

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

studentFeeTrackingSchema.pre("save",function(){
  this.academicYearWiseRecord?.forEach(yearRecord=>{
    const academic=yearRecord.academic;
    if(!academic){
      yearRecord.total=normalizeAmountSchema(yearRecord.total||{});
      return;
    }

    const odd=academic.odd;
    const even=academic.even;

    [odd,even].forEach(sem=>{
      if(!sem) return;

      sem.tuition=normalizeAmountSchema(sem.tuition||{});
      sem.exam=normalizeAmountSchema(sem.exam||{});
      sem.erp=normalizeAmountSchema(sem.erp||{});
      sem.book=normalizeAmountSchema(sem.book||{});
      sem.lab=normalizeAmountSchema(sem.lab||{});

      sem.subTotal=normalizeMoney(
        (sem.tuition?.total||0)+
        (sem.exam?.total||0)+
        (sem.erp?.total||0)+
        (sem.book?.total||0)+
        (sem.lab?.total||0)
      );

      sem.total=normalizeAmountSchema(sem.total||{});

      const semesterPaid=normalizeMoney(
        (sem.tuition?.paid||0)+
        (sem.exam?.paid||0)+
        (sem.erp?.paid||0)+
        (sem.book?.paid||0)+
        (sem.lab?.paid||0)
      );

      sem.total.paid=Math.min(semesterPaid,sem.total.total);
      if(sem.total.total===0) sem.total.status="Paid";
      else if(sem.total.paid>=sem.total.total) sem.total.status="Paid";
      else if(sem.total.paid>0) sem.total.status="Partially Paid";
      else sem.total.status="Unpaid";
    });

    academic.subTotal=normalizeMoney(
      (odd?.total?.total||0)+
      (even?.total?.total||0)
    );

    academic.academicSpecialConcession=normalizeMoney(academic.academicSpecialConcession||0);
    const payable=normalizeMoney(Math.max(0,academic.subTotal-academic.academicSpecialConcession));

    academic.total=normalizeAmountSchema(academic.total||{});
    academic.total.total=payable;

    const academicPaid=normalizeMoney((odd?.total?.paid||0)+(even?.total?.paid||0));
    academic.total.paid=Math.min(academicPaid,payable);

    if(payable===0) academic.total.status="Paid";
    else if(academic.total.paid>=payable) academic.total.status="Paid";
    else if(academic.total.paid>0) academic.total.status="Partially Paid";
    else academic.total.status="Unpaid";

    if(yearRecord.transport){
      yearRecord.transport.subTotal=normalizeMoney(yearRecord.transport.subTotal||0);
      yearRecord.transport.transportSpecialConcession=normalizeMoney(yearRecord.transport.transportSpecialConcession||0);
      yearRecord.transport.total=normalizeAmountSchema(yearRecord.transport.total||{});
      yearRecord.transport.total.total=normalizeMoney(
        Math.max(0,yearRecord.transport.subTotal-yearRecord.transport.transportSpecialConcession)
      );
      yearRecord.transport.total.paid=Math.min(
        normalizeMoney(yearRecord.transport.total.paid||0),
        yearRecord.transport.total.total
      );
      yearRecord.transport.total=normalizeAmountSchema(yearRecord.transport.total);
    }

    if(yearRecord.hostel){
      yearRecord.hostel.subTotal=normalizeMoney(yearRecord.hostel.subTotal||0);
      yearRecord.hostel.hostelSpecialConcession=normalizeMoney(yearRecord.hostel.hostelSpecialConcession||0);
      yearRecord.hostel.total=normalizeAmountSchema(yearRecord.hostel.total||{});
      yearRecord.hostel.total.total=normalizeMoney(
        Math.max(0,yearRecord.hostel.subTotal-yearRecord.hostel.hostelSpecialConcession)
      );
      yearRecord.hostel.total.paid=Math.min(
        normalizeMoney(yearRecord.hostel.total.paid||0),
        yearRecord.hostel.total.total
      );
      yearRecord.hostel.total=normalizeAmountSchema(yearRecord.hostel.total);
    }

    if(yearRecord.concessions){
      yearRecord.concessions.firstGraduate=normalizeMoney(yearRecord.concessions.firstGraduate||0);
      yearRecord.concessions.scheme7point5=normalizeMoney(yearRecord.concessions.scheme7point5||0);
      yearRecord.concessions.pmss=normalizeMoney(yearRecord.concessions.pmss||0);
      yearRecord.concessions.sakthi=normalizeMoney(yearRecord.concessions.sakthi||0);
      yearRecord.concessions.totalConcession=normalizeMoney(
        (yearRecord.concessions.firstGraduate||0)+
        (yearRecord.concessions.scheme7point5||0)+
        (yearRecord.concessions.pmss||0)+
        (yearRecord.concessions.sakthi||0)
      );
    }

    const recalculatedYearTotal=normalizeMoney(
      (academic.total?.total||0)+
      (yearRecord.transport?.total?.total||0)+
      (yearRecord.hostel?.total?.total||0)
    );

    yearRecord.total=normalizeAmountSchema(yearRecord.total||{});
    yearRecord.total.total=recalculatedYearTotal;

    const recalculatedYearPaid=normalizeMoney(
      (academic.total?.paid||0)+
      (yearRecord.transport?.total?.paid||0)+
      (yearRecord.hostel?.total?.paid||0)
    );
    yearRecord.total.paid=Math.min(recalculatedYearPaid,recalculatedYearTotal);
    yearRecord.total=normalizeAmountSchema(yearRecord.total);
  });
});

module.exports=mongoose.model("StudentFeeTracking",studentFeeTrackingSchema);
