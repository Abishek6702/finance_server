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

/* ──────────────────────────────────────────────────────────
   BULK UPSERT  (CSV / Excel → multiple academicYear docs)
   Key:   academicYear (doc level)
   Merge: quota+educationType+degreeProgram → department → semester
────────────────────────────────────────────────────────── */

const bulkUpsertFeeStructure = async (fileBuffer) => {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows  = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows.length) throw new AppError("File is empty or has no data rows.", 400);

  for (const col of BULK_REQUIRED_COLUMNS) {
    if (!(col in rawRows[0])) throw new AppError(`Missing required column: "${col}"`, 400);
  }

  // ── First pass: validate & group valid rows by academicYear ──
  const byYear    = {};
  const rowErrors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row   = rawRows[i];
    const rowNo = i + 2; // 1-based header + data offset

    const year          = String(row.academicYear  || "").trim();
    const quota         = String(row.quota         || "").trim();
    const educationType = String(row.educationType || "").trim();
    const degreeProgram = String(row.degreeProgram || "").trim();
    const departmentName = String(row.departmentName || "").trim();

    if (!year)  continue; // blank year → skip silently
    if (!quota) continue; // empty quota = "not applicable" → skip silently

    if (!/^\d{4}-\d{4}$/.test(year)) {
      rowErrors.push({ row: rowNo, error: `Invalid academicYear format: "${year}"` });
      continue;
    }
    if (!BULK_VALID_QUOTAS.includes(quota)) {
      rowErrors.push({ row: rowNo, error: `Invalid quota: "${quota}"` });
      continue;
    }
    if (!BULK_VALID_EDUCATION_TYPES.includes(educationType)) {
      rowErrors.push({ row: rowNo, error: `Invalid educationType: "${educationType}"` });
      continue;
    }
    if (!BULK_VALID_DEGREE_PROGRAMS.includes(degreeProgram)) {
      rowErrors.push({ row: rowNo, error: `Invalid degreeProgram: "${degreeProgram}"` });
      continue;
    }
    if (!BULK_VALID_DEPARTMENTS.includes(departmentName)) {
      rowErrors.push({ row: rowNo, error: `Invalid departmentName: "${departmentName}"` });
      continue;
    }

    const semNum = Number(row.semesterNumber);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) {
      rowErrors.push({ row: rowNo, error: `Invalid semesterNumber: "${row.semesterNumber}"` });
      continue;
    }

    if (!byYear[year]) byYear[year] = [];
    byYear[year].push({ year, quota, educationType, degreeProgram, departmentName, semNum,
      tuition: row.tuition, exam: row.exam, erp: row.erp, book: row.book, lab: row.lab,
      isActive: String(row.isActive ?? "true").trim().toLowerCase() !== "false",
    });
  }

  const yearKeys = Object.keys(byYear);
  if (!yearKeys.length) throw new AppError("No valid rows found after validation.", 400);

  // ── Second pass: upsert each academicYear document ──
  const created    = [];
  const updated    = [];
  const propagated = {};

  for (const academicYear of yearKeys) {
    const yearRows = byYear[academicYear];
    let   doc      = await FeeStructureMaster.findOne({ academicYear });
    const isNew    = !doc;

    if (isNew) {
      doc = new FeeStructureMaster({ academicYear, academicStructures: [], isActive: true });
    }

    // Group by (quota | educationType | degreeProgram)
    const structGroups = {};
    for (const row of yearRows) {
      const key = `${row.quota}|${row.educationType}|${row.degreeProgram}`;
      if (!structGroups[key]) structGroups[key] = [];
      structGroups[key].push(row);
    }

    for (const [key, structRows] of Object.entries(structGroups)) {
      const [quota, educationType, degreeProgram] = key.split("|");

      let struct = doc.academicStructures.find(a =>
        a.quota === quota && a.educationType === educationType && a.degreeProgram === degreeProgram
      );
      if (!struct) {
        doc.academicStructures.push({ quota, educationType, degreeProgram, departments: [], isActive: true });
        struct = doc.academicStructures[doc.academicStructures.length - 1];
      }

      // Group by departmentName
      const deptGroups = {};
      for (const row of structRows) {
        if (!deptGroups[row.departmentName]) deptGroups[row.departmentName] = [];
        deptGroups[row.departmentName].push(row);
      }

      for (const [deptName, deptRows] of Object.entries(deptGroups)) {
        let dept = struct.departments.find(d => d.departmentName === deptName);
        if (!dept) {
          struct.departments.push({
            departmentName: deptName,
            semesters: Array.from({ length: 8 }, (_, idx) => buildEmptySemester(idx + 1)),
            isActive: true,
          });
          dept = struct.departments[struct.departments.length - 1];
        }

        // Apply incoming semester rows (overwrite matching, keep others)
        for (const row of deptRows) {
          const tuition = normalizeMoney(row.tuition);
          const exam    = normalizeMoney(row.exam);
          const erp     = normalizeMoney(row.erp);
          const book    = normalizeMoney(row.book);
          const lab     = normalizeMoney(row.lab);
          const semData = {
            semesterNumber: row.semNum,
            tuition: { fee: tuition },
            exam:    { fee: exam },
            erp:     { fee: erp },
            book:    { fee: book },
            lab:     { fee: lab },
            total:   { fee: tuition + exam + erp + book + lab },
            isActive: row.isActive,
          };
          const semIdx = dept.semesters.findIndex(s => s.semesterNumber === row.semNum);
          if (semIdx >= 0) dept.semesters[semIdx] = semData;
          else dept.semesters.push(semData);
        }

        // Enforce 8-semester constraint (pads any gaps with fee:0 placeholder)
        dept.semesters = ensureEightSemesters(dept.semesters);
      }
    }

    doc.markModified("academicStructures");
    await doc.save();

    if (isNew) {
      created.push(academicYear);
    } else {
      updated.push(academicYear);
      propagated[academicYear] = await propagateFeeStructureUpdate(academicYear, doc);
    }
  }

  return { created, updated, propagated, rowErrors };
};

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure,
  bulkUpsertFeeStructure,
};
