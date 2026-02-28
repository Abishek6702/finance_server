const StudentFeeTracking=require("../studentFeeTracking/model.studentFeeTracking");
const FeeStructureMaster=require("../feeStructure/model.feeStructureMaster");
const { Transport }=require("../transport/model.transport");
const { Hostel }=require("../hostel/model.hostel");

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

  let transportDoc=null;
  if(studentDoc.transport?.isApplicable && studentDoc.transport.transport){
    const transportId=studentDoc.transport.transport?._id || studentDoc.transport.transport;
    if(studentDoc.transport.transport?.fee!==undefined){
      transportDoc={
        _id:transportId,
        fee:studentDoc.transport.transport.fee
      };
    }else{
      const query=Transport.findById(transportId).select("_id fee");
      if(session) query.session(session);
      transportDoc=await query;

      if(!transportDoc){
        console.warn(`Transport reference missing for student ${studentDoc.personal.rollNo}; skipping transport ledger`);
      }
    }
  }

  let hostelDoc=null;
  if(studentDoc.hostel?.isApplicable && studentDoc.hostel.hostel){
    const hostelId=studentDoc.hostel.hostel?._id || studentDoc.hostel.hostel;
    if(studentDoc.hostel.hostel?.fee!==undefined){
      hostelDoc={
        _id:hostelId,
        fee:studentDoc.hostel.hostel.fee,
        block:studentDoc.hostel.hostel.block,
        sharing:studentDoc.hostel.hostel.sharing,
        isAttached:studentDoc.hostel.hostel.isAttached
      };
    }else{
      const query=Hostel.findById(hostelId).select("_id fee block sharing isAttached");
      if(session) query.session(session);
      hostelDoc=await query;

      if(!hostelDoc){
        console.warn(`Hostel reference missing for student ${studentDoc.personal.rollNo}; skipping hostel ledger`);
      }
    }
  }

  const masters=await FeeStructureMaster.find({
    academicYear:{$in:years},
    isActive:true
  }).session(session||null);

  const feeMasterMap=new Map(masters.map(m=>[m.academicYear,m]));

  for(const academicYear of years){

    const feeMaster=feeMasterMap.get(academicYear);
    if(!feeMaster){
      console.warn(`Fee structure missing for ${academicYear}; skipping ledger generation for this year`);
      continue;
    }

    /* ---------- ACADEMIC ---------- */

    const academicStruct=feeMaster.academicStructures.find(a=>
      a.quota===studentDoc.enrollment.quota &&
      a.educationType===studentDoc.academic.educationType &&
      a.degreeProgram===studentDoc.academic.degreeProgram &&
      a.isActive
    );

    if(!academicStruct){
      console.warn(`Fee configuration missing for quota/educationType/degreeProgram in ${academicYear}; skipping this year`);
      continue;
    }

    const dept=academicStruct?.departments.find(d=>
      d.departmentName===studentDoc.academic.departmentName && d.isActive
    );

    if(!dept){
      console.warn(`Department fee configuration missing or inactive for ${studentDoc.academic.departmentName} in ${academicYear}; skipping this year`);
      continue;
    }

    const semesterLedgers={};

    const yearStart=parseInt(academicYear.split("-")[0],10);
    const studyYear=yearStart-batchStart+1;
    const oddSemNo=studyYear*2-1;
    const evenSemNo=studyYear*2;

    const oddSemester=dept.semesters.find(s=>s.isActive&&s.semesterNumber===oddSemNo);
    const evenSemester=dept.semesters.find(s=>s.isActive&&s.semesterNumber===evenSemNo);

    if(!oddSemester||!evenSemester){
      console.warn(`Semester fee configuration missing or inactive for semesters ${oddSemNo}/${evenSemNo} in ${academicYear}; skipping this year`);
      continue;
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
      if(transportDoc){
        const subTotal=normalizeMoney(transportDoc.fee||0);
        const special=normalizeMoney(studentDoc.enrollment?.specialConcession?.transport||0);

        transportLedger={
          transport:transportDoc._id,
          subTotal,
          transportSpecialConcession:special,
          total:{total:normalizeMoney(Math.max(0,subTotal-special))}
        };
      }
    }else if(studentDoc.transport?.isApplicable){
      console.warn(`Transport applicable but transport reference missing for student ${studentDoc.personal.rollNo} in ${academicYear}`);
    }

    /* ---------- HOSTEL ---------- */

    let hostelLedger=null;

    if(studentDoc.hostel?.isApplicable && studentDoc.hostel.hostel){
      if(hostelDoc){
        const subTotal=normalizeMoney(hostelDoc.fee||0);
        const special=normalizeMoney(studentDoc.enrollment?.specialConcession?.hostel||0);

        hostelLedger={
          hostel:hostelDoc._id,
          subTotal,
          hostelSpecialConcession:special,
          total:{total:normalizeMoney(Math.max(0,subTotal-special))}
        };
      }
    }else if(studentDoc.hostel?.isApplicable){
      console.warn(`Hostel applicable but hostel reference missing for student ${studentDoc.personal.rollNo} in ${academicYear}`);
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