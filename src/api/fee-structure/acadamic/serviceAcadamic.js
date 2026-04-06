const xlsx = require("xlsx");
const mongoose = require("mongoose");
const FeeStructureMaster = require("./modelAcadamic");
const StudentFeeTracking = require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");
const { Transport } = require("../transport/modelTransport");
const { Hostel } = require("../hostel/modelHostel");
const AppError = require("../../../utils/appError");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

/* ──────────────────────────────────────────────────────────
   BULK UPSERT HELPERS
────────────────────────────────────────────────────────── */

const BULK_VALID_QUOTAS         = ["Management Quota", "Government Quota"];
const BULK_VALID_EDUCATION_TYPES = ["UG", "PG"];
const BULK_VALID_DEGREE_PROGRAMS = ["BE", "BTech", "ME", "MTech"];
const BULK_VALID_DEPARTMENTS     = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];
const BULK_REQUIRED_COLUMNS      = ["academicYear","quota","educationType","degreeProgram","departmentName","semesterNumber","tuition","exam","erp","book","lab"];

const buildEmptySemester = (semNum) => ({
  semesterNumber: semNum,
  tuition: { fee: 0 },
  exam:    { fee: 0 },
  erp:     { fee: 0 },
  book:    { fee: 0 },
  lab:     { fee: 0 },
  isActive: true,
});

const ensureEightSemesters = (semesters) => {
  const result = [];
  for (let i = 1; i <= 8; i++) {
    result.push(semesters.find(s => s.semesterNumber === i) || buildEmptySemester(i));
  }
  return result;
};

const calculateComponentConcessions = (enrollment) => {
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
};

const findMatchingDepartment = (feeStructure, student) => {
  const matchingStructures = (feeStructure?.academicStructures || []).filter((a) =>
    a.educationType === student?.academic?.educationType &&
    a.degreeProgram === student?.academic?.degreeProgram &&
    a.isActive
  );

  for (const structure of matchingStructures) {
    const dept = (structure.departments || []).find(
      (d) => d.departmentName === student?.academic?.departmentName && d.isActive
    );
    if (dept) return dept;
  }

  return null;
};

const resolveTransportSnapshot = async (student) => {
  if (!student?.transport?.isApplicable || !student?.transport?.transport) return null;

  const transportId = student.transport.transport;
  let transportDoc = null;

  if (mongoose.isValidObjectId(transportId)) {
    transportDoc = await Transport.findById(transportId).lean();
  }

  if (!transportDoc && student.transport.route && student.transport.busNo && student.transport.stop) {
    transportDoc = await Transport.findOne({
      route: student.transport.route,
      busNo: student.transport.busNo,
      stop: student.transport.stop,
    }).lean();
  }

  const effective = transportDoc || student.transport;
  const fee = normalizeMoney(effective.fee || 0);

  return {
    transport: String(transportDoc?._id || transportId),
    route: effective.route,
    busNo: effective.busNo,
    stop: effective.stop,
    fee,
  };
};

const resolveHostelSnapshot = async (student) => {
  if (!student?.hostel?.isApplicable || !student?.hostel?.hostel) return null;

  const hostelId = student.hostel.hostel;
  let hostelDoc = null;

  if (mongoose.isValidObjectId(hostelId)) {
    hostelDoc = await Hostel.findById(hostelId).lean();
  }

  if (!hostelDoc && student.hostel.block && student.hostel.sharing && student.hostel.isAttached !== undefined) {
    hostelDoc = await Hostel.findOne({
      block: student.hostel.block,
      sharing: student.hostel.sharing,
      isAttached: student.hostel.isAttached,
    }).lean();
  }

  const effective = hostelDoc || student.hostel;
  const fee = normalizeMoney(effective.fee || 0);

  return {
    hostel: String(hostelDoc?._id || hostelId),
    block: effective.block,
    sharing: effective.sharing,
    isAttached: effective.isAttached,
    fee,
  };
};

const buildAcademicYearTrackingRow = async (student, feeStructure, academicYear) => {
  const batchStart = parseInt(student?.academic?.batch?.split("-")[0], 10);
  const yearStart = parseInt(academicYear.split("-")[0], 10);

  if (!Number.isFinite(batchStart) || !Number.isFinite(yearStart)) return null;

  const studyYear = yearStart - batchStart + 1;
  const oddSemNo = studyYear * 2 - 1;
  const evenSemNo = studyYear * 2;

  if (oddSemNo < 1 || evenSemNo > 8) return null;

  const dept = findMatchingDepartment(feeStructure, student);
  if (!dept) return null;

  const oddSemester = dept.semesters?.find(s => s.isActive && s.semesterNumber === oddSemNo);
  const evenSemester = dept.semesters?.find(s => s.isActive && s.semesterNumber === evenSemNo);
  if (!oddSemester || !evenSemester) return null;

  const concessions = calculateComponentConcessions(student.enrollment);

  const buildSemester = (semester) => {
    const tuition = normalizeMoney(semester.tuition?.fee || 0);
    const exam = normalizeMoney(semester.exam?.fee || 0);
    const erp = normalizeMoney(semester.erp?.fee || 0);
    const book = normalizeMoney(semester.book?.fee || 0);
    const lab = normalizeMoney(semester.lab?.fee || 0);
    const subTotal = normalizeMoney(tuition + exam + erp + book + lab);

    return {
      semesterNumber: semester.semesterNumber,
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

  const oddGross = oddLedger.subTotal;
  const evenGross = evenLedger.subTotal;
  const grossSum = normalizeMoney(oddGross + evenGross);
  const oddRatio = grossSum > 0 ? oddGross / grossSum : 0;
  const ACADEMIC_FIELDS = ["tuition", "exam", "erp", "book", "lab"];

  ACADEMIC_FIELDS.forEach((field) => {
    const totalConc = concessions[field];
    if (totalConc <= 0) return;

    const oddShare = normalizeMoney(totalConc * oddRatio);
    const evenShare = normalizeMoney(Math.max(0, totalConc - oddShare));

    oddLedger[field].concession = oddShare;
    oddLedger[field].total = normalizeMoney(Math.max(0, oddLedger[field].subTotal - oddShare));

    evenLedger[field].concession = evenShare;
    evenLedger[field].total = normalizeMoney(Math.max(0, evenLedger[field].subTotal - evenShare));
  });

  oddLedger.total.total = normalizeMoney(
    ACADEMIC_FIELDS.reduce((sum, field) => sum + oddLedger[field].total, 0)
  );
  evenLedger.total.total = normalizeMoney(
    ACADEMIC_FIELDS.reduce((sum, field) => sum + evenLedger[field].total, 0)
  );

  const academicSubTotal = normalizeMoney(oddLedger.subTotal + evenLedger.subTotal);
  const academicTotal = normalizeMoney(oddLedger.total.total + evenLedger.total.total);

  const transportSnapshot = await resolveTransportSnapshot(student);
  const transportLedger = transportSnapshot
    ? {
      ...transportSnapshot,
      subTotal: normalizeMoney(transportSnapshot.fee),
      total: { total: normalizeMoney(Math.max(0, transportSnapshot.fee - concessions.transport)) },
    }
    : null;

  const hostelSnapshot = await resolveHostelSnapshot(student);
  const hostelLedger = hostelSnapshot
    ? {
      ...hostelSnapshot,
      subTotal: normalizeMoney(hostelSnapshot.fee),
      total: { total: normalizeMoney(Math.max(0, hostelSnapshot.fee - concessions.hostel)) },
    }
    : null;

  const yearSubTotal = normalizeMoney(
    academicSubTotal +
    (transportLedger?.subTotal || 0) +
    (hostelLedger?.subTotal || 0)
  );

  const yearTotal = normalizeMoney(
    academicTotal +
    (transportLedger?.total.total || 0) +
    (hostelLedger?.total.total || 0)
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

const appendTrackingRowsForCurrentAcademicYearStudents = async (feeStructure) => {
  const academicYear = feeStructure.academicYear;
  const students = await Student.find({
    "academic.currentAcademicYear": academicYear
  }).lean();

  if (!students.length) return 0;

  let appendedCount = 0;

  for (const student of students) {
    const row = await buildAcademicYearTrackingRow(student, feeStructure, academicYear);
    if (!row) continue;

    let tracking = await StudentFeeTracking.findOne({ student: student._id });
    if (!tracking) {
      tracking = new StudentFeeTracking({
        student: student._id,
        rollNo: student.personal?.rollNo,
        academicYearWiseRecord: []
      });
    }

    const alreadyExists = tracking.academicYearWiseRecord.some(r => r.academicYear === academicYear);
    if (alreadyExists) continue;

    tracking.academicYearWiseRecord.push(row);
    tracking.markModified("academicYearWiseRecord");
    await tracking.save();
    appendedCount++;
  }

  return appendedCount;
};

const createFeeStructure = async (data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear: data.academicYear });
  if (existing) throw new AppError("Fee structure for this academic year already exists", 409);
  const feeStructure = await FeeStructureMaster.create(data);

  await appendTrackingRowsForCurrentAcademicYearStudents(feeStructure);

  return feeStructure;
};

const getFeeStructures = async () => {
  return await FeeStructureMaster.find().sort({ createdAt: -1 });
};

const getFeeStructureByYear = async (academicYear) => {
  const feeStructure = await FeeStructureMaster.findOne({ academicYear });
  if (!feeStructure) throw new AppError("Fee structure not found", 404);
  return feeStructure;
};

/**
 * Propagate fee structure changes to all student tracking records for the given academic year.
 * Updates individual fee component totals (tuition, exam, erp, book, lab) while preserving paid amounts.
 * The pre-save hook on StudentFeeTracking handles cascading total recalculations and status updates.
 */
const propagateFeeStructureUpdate = async (academicYear, updatedFeeStructure) => {
  const trackingRecords = await StudentFeeTracking.find({
    "academicYearWiseRecord.academicYear": academicYear
  });

  let updatedCount = 0;

  for (const tracking of trackingRecords) {
    const student = await Student.findById(tracking.student);
    if (!student) continue;

    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
    if (!yearRecord || !yearRecord.academic) continue;

    // Find matching academic structure for this student
    const dept = findMatchingDepartment(updatedFeeStructure, student);
    if (!dept) continue;

    // Calculate which semesters map to this academic year
    const batchStart = parseInt(student.academic.batch.split("-")[0], 10);
    const yearStart = parseInt(academicYear.split("-")[0], 10);
    const studyYear = yearStart - batchStart + 1;
    const oddSemNo = studyYear * 2 - 1;
    const evenSemNo = studyYear * 2;

    // Update odd semester fees (set subTotal = new gross; pre-save hook recalculates total = subTotal - concession)
    const oddSemFee = dept.semesters?.find(s => s.isActive && s.semesterNumber === oddSemNo);
    if (yearRecord.academic.odd && oddSemFee) {
      yearRecord.academic.odd.tuition.subTotal = normalizeMoney(oddSemFee.tuition?.fee || 0);
      yearRecord.academic.odd.exam.subTotal = normalizeMoney(oddSemFee.exam?.fee || 0);
      yearRecord.academic.odd.erp.subTotal = normalizeMoney(oddSemFee.erp?.fee || 0);
      yearRecord.academic.odd.book.subTotal = normalizeMoney(oddSemFee.book?.fee || 0);
      yearRecord.academic.odd.lab.subTotal = normalizeMoney(oddSemFee.lab?.fee || 0);
    }

    // Update even semester fees
    const evenSemFee = dept.semesters?.find(s => s.isActive && s.semesterNumber === evenSemNo);
    if (yearRecord.academic.even && evenSemFee) {
      yearRecord.academic.even.tuition.subTotal = normalizeMoney(evenSemFee.tuition?.fee || 0);
      yearRecord.academic.even.exam.subTotal = normalizeMoney(evenSemFee.exam?.fee || 0);
      yearRecord.academic.even.erp.subTotal = normalizeMoney(evenSemFee.erp?.fee || 0);
      yearRecord.academic.even.book.subTotal = normalizeMoney(evenSemFee.book?.fee || 0);
      yearRecord.academic.even.lab.subTotal = normalizeMoney(evenSemFee.lab?.fee || 0);
    }

    // Pre-save hook handles: academic.subTotal, academic.total.total, year total, all statuses
    tracking.markModified("academicYearWiseRecord");
    await tracking.save();
    updatedCount++;
  }

  return updatedCount;
};

const updateFeeStructure = async (academicYear, data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear });
  if (!existing) throw new AppError("Fee structure not found", 404);

  if (data.academicStructures && Array.isArray(data.academicStructures)) {
    for (const newStruct of data.academicStructures) {
      let existingStruct = existing.academicStructures.find(
        (a) =>
          a.quota === newStruct.quota &&
          a.educationType === newStruct.educationType &&
          a.degreeProgram === newStruct.degreeProgram
      );

      if (!existingStruct) {
        existing.academicStructures.push(newStruct);
        existingStruct = existing.academicStructures[existing.academicStructures.length - 1];
      } else {
        if (newStruct.isActive !== undefined) existingStruct.isActive = newStruct.isActive;

        if (newStruct.departments && Array.isArray(newStruct.departments)) {
          for (const newDept of newStruct.departments) {
            let existingDept = existingStruct.departments.find(
              (d) => d.departmentName === newDept.departmentName
            );

            if (!existingDept) {
              existingStruct.departments.push(newDept);
            } else {
              if (newDept.isActive !== undefined) existingDept.isActive = newDept.isActive;

              if (newDept.semesters && Array.isArray(newDept.semesters)) {
                for (const newSem of newDept.semesters) {
                  let existingSem = existingDept.semesters.find(
                    (s) => s.semesterNumber === newSem.semesterNumber
                  );

                  if (!existingSem) {
                    existingDept.semesters.push(newSem);
                  } else {
                    if (newSem.isActive !== undefined) existingSem.isActive = newSem.isActive;
                    
                    const feeComponents = ["tuition", "exam", "erp", "book", "lab"];
                    for (const comp of feeComponents) {
                      if (newSem[comp] !== undefined && newSem[comp].fee !== undefined) {
                        if (!existingSem[comp]) existingSem[comp] = { fee: 0 };
                        existingSem[comp].fee = newSem[comp].fee;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (data.isActive !== undefined) existing.isActive = data.isActive;

  // Mark structures modified and save to trigger Mongoose pre-validate total calculations
  existing.markModified('academicStructures');
  await existing.save();

  // Intentionally do not propagate updates to existing StudentFeeTracking rows.
  // Tracking rows are append/backfill driven and should remain immutable for historical accuracy.
  return { feeStructure: existing };
};

const deleteFeeStructure = async (academicYear) => {
  const deleted = await FeeStructureMaster.findOneAndDelete({ academicYear });
  if (!deleted) throw new AppError("Fee structure not found", 404);
  return deleted;
};

 

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure, 
};
