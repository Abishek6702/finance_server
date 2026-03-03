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

function calculateComponentConcessions(enrollment){
  const schemes=['firstGraduate','scheme7point5','pmssScheme','sakthiScheme','specialConcession'];
  const components={
    tuition:'yearlyTuitionConcessionAmount',
    exam:'yearlyExamConcessionAmount',
    erp:'yearlyErpConcessionAmount',
    book:'yearlyBookConcessionAmount',
    lab:'yearlyLabConcessionAmount',
    transport:'yearlyTransportConcessionAmount',
    hostel:'yearlyHostelConcessionAmount'
  };

  const result={};
  for(const [comp,field] of Object.entries(components)){
    result[comp]=0;
    for(const scheme of schemes){
      const schemeData=enrollment?.[scheme];
      if(schemeData?.isApplicable){
        result[comp]=normalizeMoney(result[comp]+normalizeMoney(schemeData[field]||0));
      }
    }
  }

  result.totalConcession=normalizeMoney(
    result.tuition+result.exam+result.erp+
    result.book+result.lab+result.transport+result.hostel
  );

  return result;
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
    const transportId=studentDoc.transport.transport;
    // Use embedded data from student document (no populate needed)
    if(studentDoc.transport.fee!==undefined){
      transportDoc={
        id:transportId,
        route:studentDoc.transport.route,
        busNo:studentDoc.transport.busNo,
        stop:studentDoc.transport.stop,
        fee:studentDoc.transport.fee
      };
    }else{
      const query=Transport.findOne({ id: transportId }).select("id route busNo stop fee");
      if(session) query.session(session);
      transportDoc=await query;

      if(!transportDoc){
        console.warn(`Transport reference missing for student ${studentDoc.personal.rollNo}; skipping transport ledger`);
      }
    }
  }

  let hostelDoc=null;
  if(studentDoc.hostel?.isApplicable && studentDoc.hostel.hostel){
    const hostelId=studentDoc.hostel.hostel;
    // Use embedded data from student document (no populate needed)
    if(studentDoc.hostel.fee!==undefined){
      hostelDoc={
        id:hostelId,
        block:studentDoc.hostel.block,
        sharing:studentDoc.hostel.sharing,
        isAttached:studentDoc.hostel.isAttached,
        fee:studentDoc.hostel.fee
      };
    }else{
      const query=Hostel.findOne({ id: hostelId }).select("id fee block sharing isAttached");
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

    const concessions=calculateComponentConcessions(studentDoc.enrollment);

    [oddSemester,evenSemester].forEach(s=>{

      const tuition=normalizeMoney(s.tuition?.fee||0);
      const exam=normalizeMoney(s.exam?.fee||0);
      const erp=normalizeMoney(s.erp?.fee||0);
      const book=normalizeMoney(s.book?.fee||0);
      const lab=normalizeMoney(s.lab?.fee||0);

      const tuitionPayable=normalizeMoney(Math.max(0,tuition-normalizeMoney(concessions.tuition/2)));
      const examPayable=normalizeMoney(Math.max(0,exam-normalizeMoney(concessions.exam/2)));
      const erpPayable=normalizeMoney(Math.max(0,erp-normalizeMoney(concessions.erp/2)));
      const bookPayable=normalizeMoney(Math.max(0,book-normalizeMoney(concessions.book/2)));
      const labPayable=normalizeMoney(Math.max(0,lab-normalizeMoney(concessions.lab/2)));

      const subTotal=normalizeMoney(tuitionPayable+examPayable+erpPayable+bookPayable+labPayable);

      const ledger={
        semesterNumber:s.semesterNumber,
        tuition:{total:tuitionPayable},
        exam:{total:examPayable},
        erp:{total:erpPayable},
        book:{total:bookPayable},
        lab:{total:labPayable},
        subTotal,
        total:{total:subTotal}
      };

      if(s.semesterNumber%2===1) semesterLedgers.odd=ledger;
      else semesterLedgers.even=ledger;
    });

    const academicSubTotal=normalizeMoney(
      (semesterLedgers.odd?.total?.total||0)+
      (semesterLedgers.even?.total?.total||0)
    );

    const academicConcession=normalizeMoney(
      concessions.tuition+concessions.exam+concessions.erp+
      concessions.book+concessions.lab
    );

    const academicTotal=academicSubTotal;

    /* ---------- TRANSPORT ---------- */

    let transportLedger=null;

    if(studentDoc.transport?.isApplicable && studentDoc.transport.transport){
      if(transportDoc){
        const subTotal=normalizeMoney(transportDoc.fee||0);
        const transportConcession=normalizeMoney(concessions.transport);

        transportLedger={
          transport:transportDoc.id,
          route:transportDoc.route,
          busNo:transportDoc.busNo,
          stop:transportDoc.stop,
          fee:transportDoc.fee,
          subTotal,
          transportSpecialConcession:transportConcession,
          total:{total:normalizeMoney(Math.max(0,subTotal-transportConcession))}
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
        const hostelConcession=normalizeMoney(concessions.hostel);

        hostelLedger={
          hostel:hostelDoc.id,
          block:hostelDoc.block,
          sharing:hostelDoc.sharing,
          isAttached:hostelDoc.isAttached,
          fee:hostelDoc.fee,
          subTotal,
          hostelSpecialConcession:hostelConcession,
          total:{total:normalizeMoney(Math.max(0,subTotal-hostelConcession))}
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
        academicSpecialConcession:academicConcession,
        subTotal:normalizeMoney(academicSubTotal),
        total:{total:academicTotal}
      },
      transport:transportLedger,
      hostel:hostelLedger,
      concessions:{
        tuition:concessions.tuition,
        exam:concessions.exam,
        erp:concessions.erp,
        book:concessions.book,
        lab:concessions.lab,
        transport:concessions.transport,
        hostel:concessions.hostel,
        totalConcession:concessions.totalConcession
      },
      total:{total:normalizeMoney(yearTotal)}
    });
  }

  await tracking.save({session});
}

module.exports={generateLedger,calculateComponentConcessions};