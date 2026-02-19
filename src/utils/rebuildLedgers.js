const Student=require("../models/Student");
const StudentFeeTracking=require("../models/StudentFeeTracking");
const generateLedger=require("./generateLedger");

/* ======================================================
   REBUILD LEDGERS WHEN FEE STRUCTURE CHANGES
====================================================== */

async function rebuildLedgers(feeMaster){

  // rebuild only for students whose study period includes this academic year
  const students=await Student.find({
    "academic.batch":{$regex:feeMaster.academicYear.split("-")[0]}
  });

  for(const student of students){

    const ledger=await StudentFeeTracking.findOne({student:student._id});
    const paidSnapshot=ledger?.toObject()||null;

    // regenerate ledger years (force rebuild)
    await generateLedger(student,{force:true});

    const newLedger=await StudentFeeTracking.findOne({student:student._id});
    if(!newLedger) continue;

    restorePayments(paidSnapshot,newLedger);

    await newLedger.validate();
    await newLedger.save();
  }
}


/* ======================================================
   RESTORE PAID AMOUNTS (MULTI YEAR SAFE)
====================================================== */

function restorePayments(oldLedger,newLedger){

  if(!oldLedger?.academicYearWiseRecord?.length) return;

  const yearMap=new Map(
    oldLedger.academicYearWiseRecord.map(y=>[y.academicYear,y])
  );

  newLedger.academicYearWiseRecord.forEach(newYear=>{

    const oldYear=yearMap.get(newYear.academicYear);
    if(!oldYear) return;

    // restore semester payments
    ["odd","even"].forEach(term=>{
      const newSem=newYear.academic?.[term];
      const oldSem=oldYear.academic?.[term];
      if(!newSem || !oldSem) return;

      newSem.tuition.paid=oldSem.tuition?.paid||0;
      newSem.exam.paid=oldSem.exam?.paid||0;
      newSem.erp.paid=oldSem.erp?.paid||0;
      newSem.book.paid=oldSem.book?.paid||0;
      newSem.lab.paid=oldSem.lab?.paid||0;
    });

    // transport
    if(oldYear.transport && newYear.transport){
      newYear.transport.total.paid=
        oldYear.transport.total?.paid||0;
    }

    // hostel
    if(oldYear.hostel && newYear.hostel){
      newYear.hostel.total.paid=
        oldYear.hostel.total?.paid||0;
    }
  });
}

module.exports=rebuildLedgers;
