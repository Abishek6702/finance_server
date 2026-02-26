const StudentFeeTracking=require("../../models/StudentFeeTracking");
const FeeStructureMaster=require("../../models/FeeStructureMaster");

function normalizeMoney(value){
  const number=Number(value);
  if(!Number.isFinite(number)||number<0) return 0;
  return Math.round(number*100)/100;
}

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
async function generateLedger(studentDoc,options={}){

  const session=options.session;

  // prevent duplicate ledger
  const existing=await StudentFeeTracking.findOne({student:studentDoc._id}).session(session||null);
  if(existing) return;

  const tracking=new StudentFeeTracking({
    student:studentDoc._id,
    rollNo:studentDoc.personal.rollNo,
    academicYearWiseRecord:[]
  });

  const years=getYearsToGenerate(studentDoc);
  const batchStart=parseInt(studentDoc.academic.batch.split("-")[0],10);

  const masters=await FeeStructureMaster.find({
    academicYear:{$in:years},
    isActive:true
  }).session(session||null);

  const feeMasterMap=new Map(masters.map(m=>[m.academicYear,m]));

  for(const academicYear of years){

    const feeMaster=feeMasterMap.get(academicYear);
    if(!feeMaster) throw new Error(`Fee structure missing for ${academicYear}`);

    /* ---------- ACADEMIC ---------- */

    const academicStruct=feeMaster.academicStructures.find(a=>
      a.quota===studentDoc.enrollment.quota &&
      a.educationType===studentDoc.academic.educationType &&
      a.degreeProgram===studentDoc.academic.degreeProgram &&
      a.isActive
    );

    if(!academicStruct){
      throw new Error(`Fee configuration missing for quota/educationType/degreeProgram in ${academicYear}`);
    }

    const dept=academicStruct?.departments.find(d=>
      d.departmentName===studentDoc.academic.departmentName && d.isActive
    );

    if(!dept){
      throw new Error(`Department fee configuration missing or inactive for ${studentDoc.academic.departmentName} in ${academicYear}`);
    }

    const semesterLedgers={};

    const yearStart=parseInt(academicYear.split("-")[0],10);
    const studyYear=yearStart-batchStart+1;
    const oddSemNo=studyYear*2-1;
    const evenSemNo=studyYear*2;

    const oddSemester=dept.semesters.find(s=>s.isActive&&s.semesterNumber===oddSemNo);
    const evenSemester=dept.semesters.find(s=>s.isActive&&s.semesterNumber===evenSemNo);

    if(!oddSemester||!evenSemester){
      throw new Error(`Semester fee configuration missing or inactive for semesters ${oddSemNo}/${evenSemNo} in ${academicYear}`);
    }

    [oddSemester,evenSemester].forEach(s=>{

      const tuition=normalizeMoney(s.tuition?.fee||0);
      const exam=normalizeMoney(s.exam?.fee||0);
      const erp=normalizeMoney(s.erp?.fee||0);
      const book=normalizeMoney(s.book?.fee||0);
      const lab=normalizeMoney(s.lab?.fee||0);

      const special=normalizeMoney(studentDoc.enrollment?.specialConcession?.tuition||0);

      const {subTotal,total}=calcSemesterTotals({
        tuition:{total:tuition},
        exam:{total:exam},
        erp:{total:erp},
        book:{total:book},
        lab:{total:lab}
      },special);

      const ledger={
        semesterNumber:s.semesterNumber,
        tuition:{total:tuition},
        exam:{total:exam},
        erp:{total:erp},
        book:{total:book},
        lab:{total:lab},
        subTotal:normalizeMoney(subTotal),
        total:{total:normalizeMoney(total)}
      };

      if(s.semesterNumber%2===1) semesterLedgers.odd=ledger;
      else semesterLedgers.even=ledger;
    });

    const academicSubTotal=
      (semesterLedgers.odd?.total?.total||0)+
      (semesterLedgers.even?.total?.total||0);

    const yearlyConcession=normalizeMoney(
      (studentDoc.enrollment?.firstGraduate?.concessionAmount||0)+
      (studentDoc.enrollment?.scheme7point5?.concessionAmount||0)+
      (studentDoc.enrollment?.pmssScheme?.concessionAmount||0)+
      (studentDoc.enrollment?.sakthiScheme?.concessionAmount||0)
    );

    const academicTotal=normalizeMoney(Math.max(0,academicSubTotal-yearlyConcession));

    /* ---------- TRANSPORT ---------- */

    let transportLedger=null;

    if(studentDoc.transport?.isApplicable && studentDoc.transport.transport){
      const route=feeMaster.transportStructures.find(t=>
        String(t.transport)===String(studentDoc.transport.transport) && t.isActive
      );

      if(route){
        const subTotal=normalizeMoney(route.total?.fee||0);
        const special=normalizeMoney(studentDoc.enrollment?.specialConcession?.transport||0);

        transportLedger={
          transport:studentDoc.transport.transport,
          subTotal,
          transportSpecialConcession:special,
          total:{total:normalizeMoney(Math.max(0,subTotal-special))}
        };
      }else{
        console.warn(`Transport fee mapping missing for student ${studentDoc.personal.rollNo} in ${academicYear}`);
      }
    }else if(studentDoc.transport?.isApplicable){
      console.warn(`Transport applicable but transport reference missing for student ${studentDoc.personal.rollNo} in ${academicYear}`);
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
          normalizeMoney(hostel.roomFee?.fee||0)+
          normalizeMoney(hostel.messFee?.fee||0)+
          normalizeMoney(hostel.maintenanceFee?.fee||0);

        const special=normalizeMoney(studentDoc.enrollment?.specialConcession?.hostel||0);

        hostelLedger={
          block:hostel.block,
          roomType:hostel.roomType,
          roomFee:{total:normalizeMoney(hostel.roomFee?.fee||0)},
          messFee:{total:normalizeMoney(hostel.messFee?.fee||0)},
          maintenanceFee:{total:normalizeMoney(hostel.maintenanceFee?.fee||0)},
          subTotal:normalizeMoney(subTotal),
          hostelSpecialConcession:special,
          total:{total:normalizeMoney(Math.max(0,subTotal-special))}
        };
      }else{
        console.warn(`Hostel fee mapping missing for student ${studentDoc.personal.rollNo} in ${academicYear}`);
      }
    }

    const yearTotal=
      academicTotal+
      (transportLedger?.total.total||0)+
      (hostelLedger?.total.total||0);

    tracking.academicYearWiseRecord.push({
      academicYear,
      academic:{
        ...semesterLedgers,
        academicSpecialConcession:yearlyConcession,
        subTotal:normalizeMoney(academicSubTotal),
        total:{total:academicTotal}
      },
      transport:transportLedger,
      hostel:hostelLedger,
      concessions:{
        firstGraduate:normalizeMoney(studentDoc.enrollment?.firstGraduate?.concessionAmount||0),
        scheme7point5:normalizeMoney(studentDoc.enrollment?.scheme7point5?.concessionAmount||0),
        pmss:normalizeMoney(studentDoc.enrollment?.pmssScheme?.concessionAmount||0),
        sakthi:normalizeMoney(studentDoc.enrollment?.sakthiScheme?.concessionAmount||0),
        totalConcession:yearlyConcession
      },
      total:{total:normalizeMoney(yearTotal)}
    });
  }

  await tracking.save({session});
}

module.exports={generateLedger};