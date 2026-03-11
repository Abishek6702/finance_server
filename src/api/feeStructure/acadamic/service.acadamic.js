const xlsx = require("xlsx");
const FeeStructureMaster = require("./model.acadamic");
const StudentFeeTracking = require("../../studentFeeTracking/model.studentFeeTracking");
const Student = require("../../students/model.student");
const AppError = require("../../../utils/AppError");

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

const createFeeStructure = async (data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear: data.academicYear });
  if (existing) throw new AppError("Fee structure for this academic year already exists", 409);
  const feeStructure = await FeeStructureMaster.create(data);
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
    const academicStruct = updatedFeeStructure.academicStructures?.find(a =>
      a.quota === student.enrollment?.quota &&
      a.educationType === student.academic?.educationType &&
      a.degreeProgram === student.academic?.degreeProgram &&
      a.isActive
    );

    if (!academicStruct) continue;

    const dept = academicStruct.departments?.find(d =>
      d.departmentName === student.academic?.departmentName && d.isActive
    );
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
  const updated = await FeeStructureMaster.findOneAndUpdate({ academicYear }, data, { new: true, runValidators: true });
  if (!updated) throw new AppError("Fee structure not found", 404);

  // Propagate fee changes to all student tracking records for this academic year
  const trackingUpdated = await propagateFeeStructureUpdate(academicYear, updated);
  
  return { feeStructure: updated, trackingRecordsUpdated: trackingUpdated };
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
