const FeeStructure=require("../models/FeeStructureMaster");
const StudentFeeTracking=require("../models/StudentFeeTracking");


/* ======================================================
   HELPERS
====================================================== */

function nextAcademicYear(year){
  const [start,end]=year.split("-").map(Number);
  return `${end}-${end+1}`;
}

function getYearsToGenerate(student){
  const years=[];
  const currentYear=student.academic.currentAcademicYear;
  const batchEnd=parseInt(student.academic.batch.split("-")[1],10);

  let yr=currentYear;
  while(parseInt(yr.split("-")[0])<batchEnd){
    years.push(yr);
    yr=nextAcademicYear(yr);
  }

  return years;
}

function calcSemesterTotals(sem,concession=0){
  const subTotal=
    (sem.tuition?.total||0)+
    (sem.exam?.total||0)+
    (sem.erp?.total||0)+
    (sem.book?.total||0)+
    (sem.lab?.total||0);

  const total=Math.max(0,subTotal-concession);
  return {subTotal,total};
}


/* ======================================================
   GENERATE LEDGER
====================================================== */

async function generateLedger(studentDoc,options={}){
  const {force=false}=options;

  let tracking=await StudentFeeTracking.findOne({student:studentDoc._id});

  if(!tracking){
    tracking=new StudentFeeTracking({
      student:studentDoc._id,
      rollNo:studentDoc.personal.rollNo,
      academicYearWiseRecord:[]
    });
  }

  const years=getYearsToGenerate(studentDoc);
  const batchStart=parseInt(studentDoc.academic.batch.split("-")[0],10);

  for(const academicYear of years){

    const exists=tracking.academicYearWiseRecord.find(r=>r.academicYear===academicYear);
    if(exists && !force) continue;

    const feeMaster=await FeeStructure.findOne({academicYear,isActive:true});
    if(!feeMaster) break;

    /* ---------- ACADEMIC ---------- */

    const academicStruct=feeMaster.academicStructures.find(a=>
      a.quota===studentDoc.enrollment.quota &&
      a.educationType===studentDoc.academic.educationType &&
      a.degreeProgram===studentDoc.academic.degreeProgram &&
      a.isActive
    );

    const dept=academicStruct?.departments.find(d=>
      d.departmentName===studentDoc.academic.departmentName &&
      d.isActive
    );

    const semesterLedgers={};

    if(dept){
      const yearStart=parseInt(academicYear.split("-")[0],10);
      const studyYear=yearStart-batchStart+1;
      const oddSemNo =studyYear*2-1;
      const evenSemNo=studyYear*2;

      dept.semesters
        .filter(s=>s.isActive && (s.semesterNumber===oddSemNo || s.semesterNumber===evenSemNo))
        .forEach(s=>{

          const tuition=s.tuition.fee||0;
          const exam   =s.exam.fee||0;
          const erp    =s.erp.fee||0;
          const book   =s.book.fee||0;
          const lab    =s.lab.fee||0;
          const special=studentDoc.enrollment.specialConcession.tuition||0;

          const {subTotal,total}=calcSemesterTotals(
            {tuition:{total:tuition},exam:{total:exam},erp:{total:erp},book:{total:book},lab:{total:lab}},
            special
          );

          const ledger={
            semesterNumber:s.semesterNumber,
            tuition:{total:tuition},
            exam:{total:exam},
            erp:{total:erp},
            book:{total:book},
            lab:{total:lab},
            subTotal,
            specialConcession:special,
            total:{total}
          };

          if(s.semesterNumber%2===1) semesterLedgers.odd=ledger;
          else semesterLedgers.even=ledger;
        });
    }

    const academicSubTotal=
      (semesterLedgers.odd?.total?.total||0)+
      (semesterLedgers.even?.total?.total||0);

    const yearlyConcession=
      (studentDoc.enrollment.firstGraduate.concessionAmount||0)+
      (studentDoc.enrollment.scheme7point5.concessionAmount||0)+
      (studentDoc.enrollment.pmssScheme.concessionAmount||0)+
      (studentDoc.enrollment.sakthiScheme.concessionAmount||0);

    const academicTotal=Math.max(0,academicSubTotal-yearlyConcession);

    /* ---------- TRANSPORT ---------- */

    let transportLedger=null;

    if(studentDoc.transport?.isApplicable){
      const route=feeMaster.transportStructures.find(t=>
        t.route===studentDoc.transport.route &&
        t.stopName?.toUpperCase()===studentDoc.transport.stopName?.toUpperCase() &&
        t.isActive
      );

      if(route){
        const subTotal=route.total.fee||0;
        const special =studentDoc.enrollment.specialConcession.transport||0;
        const total   =Math.max(0,subTotal-special);

        transportLedger={
          route:route.route,
          stopName:route.stopName,
          distanceKM:route.distanceKM,
          subTotal,
          specialConcession:special,
          total:{total}
        };
      }
    }

    /* ---------- HOSTEL ---------- */

    let hostelLedger=null;

    if(studentDoc.hostel?.isApplicable){
      const hostel=feeMaster.hostelStructures.find(h=>
        h.block===studentDoc.hostel.block &&
        h.roomType.sharingType===studentDoc.hostel.roomType.sharingType &&
        h.roomType.isAttached===studentDoc.hostel.roomType.isAttached &&
        h.isActive
      );

      if(hostel){
        const subTotal=
          (hostel.roomFee.fee||0)+
          (hostel.messFee.fee||0)+
          (hostel.maintenanceFee.fee||0);

        const special=studentDoc.enrollment.specialConcession.hostel||0;
        const total  =Math.max(0,subTotal-special);

        hostelLedger={
          block:hostel.block,
          roomType:hostel.roomType,
          roomFee:{total:hostel.roomFee.fee},
          messFee:{total:hostel.messFee.fee},
          maintenanceFee:{total:hostel.maintenanceFee.fee},
          subTotal,
          specialConcession:special,
          total:{total}
        };
      }
    }

    /* ---------- YEAR RECORD ---------- */

    const yearTotal=
      academicTotal+
      (transportLedger?.total.total||0)+
      (hostelLedger?.total.total||0);

    const record={
      academicYear,
      academic:{
        ...semesterLedgers,
        subTotal:academicSubTotal,
        total:{total:academicTotal}
      },
      transport:transportLedger,
      hostel:hostelLedger,
      concessions:{
        firstGraduate:studentDoc.enrollment.firstGraduate.concessionAmount||0,
        scheme7point5:studentDoc.enrollment.scheme7point5.concessionAmount||0,
        pmss:studentDoc.enrollment.pmssScheme.concessionAmount||0,
        sakthi:studentDoc.enrollment.sakthiScheme.concessionAmount||0,
        totalConcession:yearlyConcession
      },
      total:{total:yearTotal}
    };

    tracking.academicYearWiseRecord.push(record);
  }

  await tracking.save();
}

module.exports=generateLedger;
