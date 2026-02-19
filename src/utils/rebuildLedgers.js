const Student=require("../models/Student");
const StudentFeeTracking=require("../models/StudentFeeTracking");
const generateLedger=require("./generateLedger");


/* ======================================================
   REBUILD LEDGERS WHEN FEE STRUCTURE CHANGES
====================================================== */

async function rebuildLedgers(feeMaster){

  const [yearStart]=feeMaster.academicYear.split("-").map(Number);

  const allStudents=await Student.find({"academic.batch":{$regex:/^\d{4}-\d{4}$/}});

  const students=allStudents.filter(s=>{
    const [bs,be]=s.academic.batch.split("-").map(Number);
    return bs<=yearStart && be>yearStart;
  });

  for(const student of students){

    const ledger=await StudentFeeTracking.findOne({student:student._id});
    const paidSnapshot=ledger?.toObject()||null;

    await generateLedger(student,{force:true});

    const newLedger=await StudentFeeTracking.findOne({student:student._id});
    if(!newLedger) continue;

    restorePayments(paidSnapshot,newLedger);

    await newLedger.validate();
    await newLedger.save();
  }
}


/* ======================================================
   RESTORE PAID AMOUNTS AFTER REBUILD
====================================================== */

function restorePayments(oldLedger,newLedger){

  if(!oldLedger?.academicYearWiseRecord?.length) return;

  const yearMap=new Map(
    oldLedger.academicYearWiseRecord.map(y=>[y.academicYear,y])
  );

  newLedger.academicYearWiseRecord.forEach(newYear=>{

    const oldYear=yearMap.get(newYear.academicYear);
    if(!oldYear) return;

    /* ---------- SEMESTERS ---------- */

    ["odd","even"].forEach(term=>{
      const newSem=newYear.academic?.[term];
      const oldSem=oldYear.academic?.[term];
      if(!newSem || !oldSem) return;

      newSem.tuition.paid=oldSem.tuition?.paid||0;
      newSem.exam.paid   =oldSem.exam?.paid||0;
      newSem.erp.paid    =oldSem.erp?.paid||0;
      newSem.book.paid   =oldSem.book?.paid||0;
      newSem.lab.paid    =oldSem.lab?.paid||0;
    });

    /* ---------- TRANSPORT ---------- */

    if(oldYear.transport && newYear.transport){
      newYear.transport.total.paid=oldYear.transport.total?.paid||0;
    }

    /* ---------- HOSTEL ---------- */

    if(oldYear.hostel && newYear.hostel){
      newYear.hostel.total.paid          =oldYear.hostel.total?.paid||0;
      newYear.hostel.roomFee.paid        =oldYear.hostel.roomFee?.paid||0;
      newYear.hostel.messFee.paid        =oldYear.hostel.messFee?.paid||0;
      newYear.hostel.maintenanceFee.paid =oldYear.hostel.maintenanceFee?.paid||0;
    }
  });
}

module.exports=rebuildLedgers;
