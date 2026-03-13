const StudentFeeTracking = require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const FeeStructureMaster = require("../../fee-structure/acadamic/modelAcadamic");
const { Transport } = require("../../fee-structure/transport/modelTransport");
const { Hostel } = require("../../fee-structure/hostel/modelHostel");

const MAX_SEMESTER = 8;

/* =======================================================
   UTILITIES
======================================================= */

function normalizeMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

/*
  Only the current academic year ledger is created at enrollment time.
  Future years are added when the student is promoted to the next academic year.
*/
function getYearsToGenerate(student) {
  const currentYear = student.academic.currentAcademicYear;
  const batchStart  = parseInt(student.academic.batch.split("-")[0], 10);
  const yearStart   = parseInt(currentYear.split("-")[0], 10);
  const studyYear   = yearStart - batchStart + 1;
  const oddSemNo    = studyYear * 2 - 1;
  const evenSemNo   = studyYear * 2;

  if (oddSemNo > MAX_SEMESTER || evenSemNo > MAX_SEMESTER) return [];
  return [currentYear];
}

function calculateComponentConcessions(enrollment) {
  const schemes = [
    "firstGraduate",
    "scheme7point5",
    "pmssScheme",
    "sakthiScheme",
    "specialConcession"
  ];

  const components = {
    tuition: "yearlyTuitionConcessionAmount",
    exam: "yearlyExamConcessionAmount",
    erp: "yearlyErpConcessionAmount",
    book: "yearlyBookConcessionAmount",
    lab: "yearlyLabConcessionAmount",
    transport: "yearlyTransportConcessionAmount",
    hostel: "yearlyHostelConcessionAmount"
  };

  const result = {};

  for (const [comp, field] of Object.entries(components)) {
    result[comp] = 0;

    for (const scheme of schemes) {
      const schemeData = enrollment?.[scheme];
      if (schemeData?.isApplicable) {
        result[comp] = normalizeMoney(
          result[comp] + normalizeMoney(schemeData[field] || 0)
        );
      }
    }
  }

  result.totalConcession = normalizeMoney(
    result.tuition +
    result.exam +
    result.erp +
    result.book +
    result.lab +
    result.transport +
    result.hostel
  );

  return result;
}

function findMatchingDepartment(feeMaster, studentDoc) {
  const matchingStructures = (feeMaster?.academicStructures || []).filter((a) =>
    a.educationType === studentDoc.academic.educationType &&
    a.degreeProgram === studentDoc.academic.degreeProgram &&
    a.isActive
  );

  for (const structure of matchingStructures) {
    const dept = (structure.departments || []).find(
      (d) => d.departmentName === studentDoc.academic.departmentName && d.isActive
    );
    if (dept) return dept;
  }

  return null;
}

/* =======================================================
   GENERATE LEDGER
======================================================= */

async function generateLedger(studentDoc, options = {}) {
  const session = options.session;

  const years = getYearsToGenerate(studentDoc);
  if (!years.length) return null;

  const batchStart = parseInt(studentDoc.academic.batch.split("-")[0], 10);

  let transportDoc = null;
  if (studentDoc.transport?.isApplicable && studentDoc.transport.transport) {
    transportDoc = {
      id: studentDoc.transport.transport,
      route: studentDoc.transport.route,
      busNo: studentDoc.transport.busNo,
      stop: studentDoc.transport.stop,
      fee: studentDoc.transport.fee
    };
  }

  let hostelDoc = null;
  if (studentDoc.hostel?.isApplicable && studentDoc.hostel.hostel) {
    hostelDoc = {
      id: studentDoc.hostel.hostel,
      block: studentDoc.hostel.block,
      sharing: studentDoc.hostel.sharing,
      isAttached: studentDoc.hostel.isAttached,
      fee: studentDoc.hostel.fee
    };
  }

  const masters = await FeeStructureMaster.find({
    academicYear: { $in: years },
    isActive: true
  }).session(session || null); 
  const feeMasterMap = new Map(masters.map(m => [m.academicYear, m]));

  const buildYearRecord = (academicYear) => {

    const feeMaster = feeMasterMap.get(academicYear);
    if (!feeMaster) return null;

    const dept = findMatchingDepartment(feeMaster, studentDoc);

    if (!dept) return null;

    const yearStart = parseInt(academicYear.split("-")[0], 10);
    const studyYear = yearStart - batchStart + 1;

    const oddSemNo = studyYear * 2 - 1;
    const evenSemNo = studyYear * 2;

    const oddSemester = dept.semesters.find(s =>
      s.isActive && s.semesterNumber === oddSemNo
    );

    const evenSemester = dept.semesters.find(s =>
      s.isActive && s.semesterNumber === evenSemNo
    );

    if (!oddSemester || !evenSemester) return null;

    const concessions = calculateComponentConcessions(studentDoc.enrollment);

    const buildSemester = (s) => {

      const tuition = normalizeMoney(s.tuition?.fee || 0);
      const exam = normalizeMoney(s.exam?.fee || 0);
      const erp = normalizeMoney(s.erp?.fee || 0);
      const book = normalizeMoney(s.book?.fee || 0);
      const lab = normalizeMoney(s.lab?.fee || 0);

      const subTotal = normalizeMoney(
        tuition + exam + erp + book + lab
      );

      return {
        semesterNumber: s.semesterNumber,
        tuition: { concession: 0, subTotal: tuition, total: tuition },
        exam: { concession: 0, subTotal: exam, total: exam },
        erp: { concession: 0, subTotal: erp, total: erp },
        book: { concession: 0, subTotal: book, total: book },
        lab: { concession: 0, subTotal: lab, total: lab },
        subTotal,
        total: { total: subTotal }
      };
    };

    const oddLedger = buildSemester(oddSemester);
    const evenLedger = buildSemester(evenSemester);

    /* ─── Apply per-category academic concessions proportionally ─── */
    const oddGross  = oddLedger.subTotal;
    const evenGross = evenLedger.subTotal;
    const grossSum  = normalizeMoney(oddGross + evenGross);
    const oddRatio  = grossSum > 0 ? oddGross / grossSum : 0;

    const ACADEMIC_FIELDS = ["tuition", "exam", "erp", "book", "lab"];

    ACADEMIC_FIELDS.forEach((field) => {
      const totalConc = concessions[field];
      if (totalConc <= 0) return;

      const oddShare  = normalizeMoney(totalConc * oddRatio);
      const evenShare = normalizeMoney(Math.max(0, totalConc - oddShare));

      oddLedger[field].concession = oddShare;
      oddLedger[field].total  = normalizeMoney(Math.max(0, oddLedger[field].subTotal - oddShare));

      evenLedger[field].concession = evenShare;
      evenLedger[field].total = normalizeMoney(Math.max(0, evenLedger[field].subTotal - evenShare));
    });

    /* Recalculate NET semester totals after concession application.
       subTotal stays GROSS (set in buildSemester). */
    oddLedger.total.total = normalizeMoney(
      ACADEMIC_FIELDS.reduce((sum, f) => sum + oddLedger[f].total, 0)
    );

    evenLedger.total.total = normalizeMoney(
      ACADEMIC_FIELDS.reduce((sum, f) => sum + evenLedger[f].total, 0)
    );

    /* academicSubTotal = GROSS (both semesters); academicTotal = NET */
    const academicSubTotal = normalizeMoney(oddLedger.subTotal + evenLedger.subTotal);
    const academicTotal = normalizeMoney(
      oddLedger.total.total + evenLedger.total.total
    );

    const transportLedger = transportDoc
      ? {
        ...transportDoc,
        subTotal: normalizeMoney(transportDoc.fee),
        total: { total: normalizeMoney(Math.max(0, transportDoc.fee - concessions.transport)) }
      }
      : null;

    const hostelLedger = hostelDoc
      ? {
        ...hostelDoc,
        subTotal: normalizeMoney(hostelDoc.fee),
        total: { total: normalizeMoney(Math.max(0, hostelDoc.fee - concessions.hostel)) }
      }
      : null;

    const yearTotal = normalizeMoney(
      academicTotal +
      (transportLedger?.total.total || 0) +
      (hostelLedger?.total.total || 0)
    );

    const yearSubTotal = normalizeMoney(
      academicSubTotal +
      (transportLedger?.subTotal || 0) +
      (hostelLedger?.subTotal || 0)
    );

    return {
      academicYear,
      academic: {
        odd: oddLedger,
        even: evenLedger,
        subTotal: academicSubTotal,
        total: { total: academicTotal }
      },
      transport: transportLedger,
      hostel: hostelLedger,
      concessions,
      subTotal: yearSubTotal,
      total: { total: yearTotal }
    };
  };

  const existing = await StudentFeeTracking
    .findOne({ student: studentDoc._id })
    .session(session || null);

  if (existing) {
    let appended = false;

    for (const academicYear of years) {
      const alreadyExists = existing.academicYearWiseRecord.some(r => r.academicYear === academicYear);
      if (alreadyExists) continue;

      const yearRecord = buildYearRecord(academicYear);
      if (!yearRecord) continue;

      existing.academicYearWiseRecord.push(yearRecord);
      appended = true;
    }

    if (appended) {
      existing.markModified("academicYearWiseRecord");
      await existing.save({ session });
    }

    return existing;
  }

  const tracking = new StudentFeeTracking({
    student: studentDoc._id,
    rollNo: studentDoc.personal.rollNo,
    academicYearWiseRecord: []
  });

  for (const academicYear of years) {
    const yearRecord = buildYearRecord(academicYear);
    if (!yearRecord) continue;
    tracking.academicYearWiseRecord.push(yearRecord);
  }

  await tracking.save({ session });  
  return tracking;
}

module.exports = { generateLedger };