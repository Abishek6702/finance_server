const mongoose = require("mongoose");
const AppError = require("../../../utils/appError");
const Student = require("../../student/students-management/modelStudent");
const StudentFeeTracking = require("./modelStudentFeeTracking");
const FeeStructureMaster = require("../../fee-structure/acadamic/modelAcadamic");

const MAX_SEMESTER = 8;

const BULK_VALID_QUOTAS = ["Management Quota", "Government Quota"];
const BULK_VALID_EDUCATION_TYPES = ["UG", "PG"];
const BULK_VALID_DEGREE_PROGRAMS = ["BE", "BTech", "ME", "MTech"];
const BULK_VALID_DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
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

  for (const [componentName, fieldName] of Object.entries(components)) {
    result[componentName] = 0;

    for (const schemeName of schemes) {
      const schemeData = enrollment?.[schemeName];
      if (schemeData?.isApplicable) {
        result[componentName] = normalizeMoney(
          result[componentName] + normalizeMoney(schemeData[fieldName] || 0)
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

const findMatchingDepartment = ({ feeStructure, student, quota }) => {
  const academicStructures = feeStructure?.academicStructures || [];

  const filteredStructures = academicStructures.filter((structure) => {
    if (!structure.isActive) return false;
    if (structure.educationType !== student?.academic?.educationType) return false;
    if (structure.degreeProgram !== student?.academic?.degreeProgram) return false;

    if (quota && structure.quota !== quota) return false;
    return true;
  });

  const structuresToScan = filteredStructures.length > 0
    ? filteredStructures
    : academicStructures.filter((structure) => {
      if (!structure.isActive) return false;
      return (
        structure.educationType === student?.academic?.educationType &&
        structure.degreeProgram === student?.academic?.degreeProgram
      );
    });

  for (const structure of structuresToScan) {
    const department = (structure.departments || []).find(
      (dept) => dept.isActive && dept.departmentName === student?.academic?.departmentName
    );

    if (department) return department;
  }

  return null;
};

const resolveTransportSnapshot = (student) => {
  if (!student?.transport?.isApplicable || !student?.transport?.transport) return null;

  return {
    transport: String(student.transport.transport),
    route: student.transport.route,
    busNo: student.transport.busNo,
    stop: student.transport.stop,
    fee: normalizeMoney(student.transport.fee || 0),
    isActive: student.transport.isActive !== false,
    effectiveDate: student.transport.effectiveDate || null,
    endDate: student.transport.endDate || null,
    consumedAmount: normalizeMoney(student.transport.consumedAmount || 0),
  };
};

const resolveHostelSnapshot = (student) => {
  if (!student?.hostel?.isApplicable || !student?.hostel?.hostel) return null;

  return {
    hostel: String(student.hostel.hostel),
    block: student.hostel.block,
    sharing: student.hostel.sharing,
    isAttached: student.hostel.isAttached,
    fee: normalizeMoney(student.hostel.fee || 0),
    isActive: student.hostel.isActive !== false,
    effectiveDate: student.hostel.effectiveDate || null,
    endDate: student.hostel.endDate || null,
    consumedAmount: normalizeMoney(student.hostel.consumedAmount || 0),
  };
};

const buildSemesterLedger = (semester) => {
  const tuition = normalizeMoney(semester?.tuition?.fee || 0);
  const exam = normalizeMoney(semester?.exam?.fee || 0);
  const erp = normalizeMoney(semester?.erp?.fee || 0);
  const book = normalizeMoney(semester?.book?.fee || 0);
  const lab = normalizeMoney(semester?.lab?.fee || 0);

  const subTotal = normalizeMoney(tuition + exam + erp + book + lab);

  return {
    semesterNumber: semester.semesterNumber,
    tuition: { concession: 0, subTotal: tuition, total: tuition },
    exam: { concession: 0, subTotal: exam, total: exam },
    erp: { concession: 0, subTotal: erp, total: erp },
    book: { concession: 0, subTotal: book, total: book },
    lab: { concession: 0, subTotal: lab, total: lab },
    subTotal,
    total: { total: subTotal },
  };
};

const applyAcademicConcessions = ({ oddLedger, evenLedger, concessions }) => {
  const ACADEMIC_FIELDS = ["tuition", "exam", "erp", "book", "lab"];

  const oddGross = oddLedger.subTotal;
  const evenGross = evenLedger.subTotal;
  const grossSum = normalizeMoney(oddGross + evenGross);
  const oddRatio = grossSum > 0 ? oddGross / grossSum : 0;

  ACADEMIC_FIELDS.forEach((field) => {
    const totalConcession = concessions[field];
    if (totalConcession <= 0) return;

    const oddShare = normalizeMoney(totalConcession * oddRatio);
    const evenShare = normalizeMoney(Math.max(0, totalConcession - oddShare));

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
};

const buildAcademicYearTrackingRow = ({ student, feeStructure, academicYear, quota }) => {
  const batchStart = parseInt(String(student?.academic?.batch || "").split("-")[0], 10);
  const yearStart = parseInt(String(academicYear || "").split("-")[0], 10);

  if (!Number.isFinite(batchStart) || !Number.isFinite(yearStart)) {
    throw new AppError(
      `Cannot build fee tracking row for ${student?.personal?.rollNo || "student"}: invalid batch/current year values`,
      400
    );
  }

  const studyYear = yearStart - batchStart + 1;
  const oddSemNo = studyYear * 2 - 1;
  const evenSemNo = studyYear * 2;

  if (oddSemNo < 1 || evenSemNo > MAX_SEMESTER) {
    throw new AppError(
      `Cannot build fee tracking row for ${student?.personal?.rollNo || "student"}: computed semesters are out of range`,
      400
    );
  }

  const department = findMatchingDepartment({ feeStructure, student, quota });
  if (!department) {
    throw new AppError(
      `No active fee structure department match for ${student?.personal?.rollNo || "student"} in academicYear ${academicYear}`,
      404
    );
  }

  const oddSemester = (department.semesters || []).find(
    (semester) => semester.isActive && semester.semesterNumber === oddSemNo
  );
  const evenSemester = (department.semesters || []).find(
    (semester) => semester.isActive && semester.semesterNumber === evenSemNo
  );

  if (!oddSemester || !evenSemester) {
    throw new AppError(
      `Fee structure semesters ${oddSemNo}/${evenSemNo} are missing or inactive for ${student?.personal?.rollNo || "student"}`,
      404
    );
  }

  const concessions = calculateComponentConcessions(student.enrollment);

  const oddLedger = buildSemesterLedger(oddSemester);
  const evenLedger = buildSemesterLedger(evenSemester);

  applyAcademicConcessions({ oddLedger, evenLedger, concessions });

  const academicSubTotal = normalizeMoney(oddLedger.subTotal + evenLedger.subTotal);
  const academicTotal = normalizeMoney(oddLedger.total.total + evenLedger.total.total);

  const transportSnapshot = resolveTransportSnapshot(student);
  const transportLedger = transportSnapshot
    ? {
        ...transportSnapshot,
        subTotal: normalizeMoney(transportSnapshot.fee),
        total: {
          total: normalizeMoney(Math.max(0, transportSnapshot.fee - concessions.transport))
        }
      }
    : null;

  const hostelSnapshot = resolveHostelSnapshot(student);
  const hostelLedger = hostelSnapshot
    ? {
        ...hostelSnapshot,
        subTotal: normalizeMoney(hostelSnapshot.fee),
        total: {
          total: normalizeMoney(Math.max(0, hostelSnapshot.fee - concessions.hostel))
        }
      }
    : null;

  const subTotal = normalizeMoney(
    academicSubTotal + (transportLedger?.subTotal || 0) + (hostelLedger?.subTotal || 0)
  );

  const total = normalizeMoney(
    academicTotal + (transportLedger?.total?.total || 0) + (hostelLedger?.total?.total || 0)
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
    subTotal,
    total: { total }
  };
};

const getSessionFromOptions = (options = {}) => {
  const session = options.session || null;
  const queryOptions = session ? { session } : {};
  return { session, queryOptions };
};

const upsertTrackingRowsForStudent = async (studentDoc, options = {}) => {
  const { session, queryOptions } = getSessionFromOptions(options);

  if (!studentDoc?._id) {
    throw new AppError("Student document is required to sync fee tracking", 400);
  }

  const academicYears = Array.isArray(options.academicYears) && options.academicYears.length > 0
    ? options.academicYears
    : [studentDoc?.academic?.currentAcademicYear].filter(Boolean);

  if (!academicYears.length) {
    throw new AppError("No academicYear available to sync fee tracking", 400);
  }

  const feeStructures = await FeeStructureMaster.find({
    academicYear: { $in: academicYears },
    isActive: true,
  }, null, queryOptions).lean();

  const feeStructureMap = new Map(feeStructures.map((row) => [row.academicYear, row]));

  const tracking = await StudentFeeTracking.findOne({ student: studentDoc._id }, null, queryOptions);
  const workingTracking = tracking || new StudentFeeTracking({
    student: studentDoc._id,
    rollNo: studentDoc?.personal?.rollNo,
    academicYearWiseRecord: []
  });

  if (!workingTracking.rollNo && studentDoc?.personal?.rollNo) {
    workingTracking.rollNo = studentDoc.personal.rollNo;
  }

  let appended = 0;
  let replaced = 0;

  for (const academicYear of academicYears) {
    const feeStructure = feeStructureMap.get(academicYear);
    if (!feeStructure) {
      if (options.skipMissingFeeStructure === true) {
        continue;
      }
      throw new AppError(`No active fee structure found for academicYear ${academicYear}`, 404);
    }

    const row = buildAcademicYearTrackingRow({
      student: studentDoc,
      feeStructure,
      academicYear,
      quota: studentDoc?.enrollment?.quota,
    });

    const index = workingTracking.academicYearWiseRecord.findIndex(
      (record) => record.academicYear === academicYear
    );

    if (index === -1) {
      workingTracking.academicYearWiseRecord.push(row);
      appended += 1;
    } else if (options.replaceExisting === true) {
      workingTracking.academicYearWiseRecord[index] = row;
      replaced += 1;
    }
  }

  if (!tracking || appended > 0 || replaced > 0) {
    workingTracking.markModified("academicYearWiseRecord");
    await workingTracking.save(queryOptions);
  }

  return {
    tracking: workingTracking,
    appended,
    replaced,
  };
};

const buildStudentFilter = (payload) => {
  const query = {
    "academic.currentAcademicYear": payload.academicYear,
  };

  if (payload.quota) query["enrollment.quota"] = payload.quota;
  if (payload.educationType) query["academic.educationType"] = payload.educationType;
  if (payload.degreeProgram) query["academic.degreeProgram"] = payload.degreeProgram;
  if (payload.departmentName) query["academic.departmentName"] = payload.departmentName;
  if (payload.semesterNumber) query["academic.currentSemesterNumber"] = payload.semesterNumber;

  return query;
};

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const triggerBulkFeeTrackingRefresh = async (payload) => {
  return runInTransaction(async (session) => {
    const query = buildStudentFilter(payload);

    const students = await Student.find(query).session(session);
    if (!students.length) {
      throw new AppError("No students found for the provided filter", 404);
    }

    let updatedCount = 0;

    for (const student of students) {
      await upsertTrackingRowsForStudent(student, {
        session,
        academicYears: [payload.academicYear],
        replaceExisting: true,
      });
      updatedCount += 1;
    }

    return {
      matchedStudents: students.length,
      updatedStudents: updatedCount,
      filtersApplied: {
        academicYear: payload.academicYear,
        quota: payload.quota || null,
        educationType: payload.educationType || null,
        degreeProgram: payload.degreeProgram || null,
        departmentName: payload.departmentName || null,
        semesterNumber: payload.semesterNumber || null,
      }
    };
  });
};

const getNextAcademicYear = (academicYear) => {
  const start = parseInt(String(academicYear || "").split("-")[0], 10);
  if (!Number.isFinite(start)) {
    throw new AppError(`Invalid academicYear format: ${academicYear}`, 400);
  }
  return `${start + 1}-${start + 2}`;
};

const getPreviousAcademicYear = (academicYear) => {
  const start = parseInt(String(academicYear || "").split("-")[0], 10);
  if (!Number.isFinite(start)) {
    throw new AppError(`Invalid academicYear format: ${academicYear}`, 400);
  }
  return `${start - 1}-${start}`;
};

const triggerPromotion = async ({ currentAcademicYear }) => {
  return runInTransaction(async (session) => {
    const students = await Student.find({
      "academic.currentAcademicYear": currentAcademicYear,
      passedout: { $ne: true },
    }).session(session);

    if (!students.length) {
      throw new AppError("No active students found for the given currentAcademicYear", 404);
    }

    const touchedRollNos = [];
    const passedOutRollNos = [];
    let trackingRowsCreated = 0;

    for (const student of students) {
      const currentSem = Number(student?.academic?.currentSemesterNumber || 0);
      if (!Number.isFinite(currentSem) || currentSem < 1 || currentSem > 8) {
        throw new AppError(
          `Invalid currentSemesterNumber for student ${student?.personal?.rollNo || student?._id}`,
          400
        );
      }

      if (currentSem >= 8) {
        student.passedout = true;
        await student.save({ session });
        passedOutRollNos.push(student.personal?.rollNo || String(student._id));
        continue;
      }

      const nextSem = currentSem + 1;
      const movesToNextAcademicYear = currentSem % 2 === 0;

      if (movesToNextAcademicYear) {
        student.academic.currentAcademicYear = getNextAcademicYear(student.academic.currentAcademicYear);
      }

      student.academic.currentSemesterNumber = nextSem;
      student.academic.yearStudying = Math.ceil(nextSem / 2);
      student.passedout = false;

      await student.save({ session });
      touchedRollNos.push(student.personal?.rollNo || String(student._id));

      if (movesToNextAcademicYear) {
        const result = await upsertTrackingRowsForStudent(student, {
          session,
          academicYears: [student.academic.currentAcademicYear],
          replaceExisting: true,
        });
        trackingRowsCreated += result.appended + result.replaced;
      }
    }

    return {
      matchedStudents: students.length,
      promotedStudents: touchedRollNos.length,
      passedOutStudents: passedOutRollNos.length,
      trackingRowsCreated,
    };
  });
};

const triggerDepromotion = async ({ currentAcademicYear }) => {
  return runInTransaction(async (session) => {
    const students = await Student.find({
      "academic.currentAcademicYear": currentAcademicYear,
    }).session(session);

    if (!students.length) {
      throw new AppError("No students found for the given currentAcademicYear", 404);
    }

    const invalid = students.find((student) => Number(student?.academic?.currentSemesterNumber || 0) <= 1);
    if (invalid) {
      throw new AppError(
        `Cannot depromote because student ${invalid?.personal?.rollNo || invalid?._id} is already in semester 1`,
        400
      );
    }

    for (const student of students) {
      const currentSem = Number(student.academic.currentSemesterNumber);
      const nextSem = currentSem - 1;
      const movesToPreviousAcademicYear = currentSem % 2 === 1;

      if (movesToPreviousAcademicYear) {
        student.academic.currentAcademicYear = getPreviousAcademicYear(student.academic.currentAcademicYear);
      }

      student.academic.currentSemesterNumber = nextSem;
      student.academic.yearStudying = Math.ceil(nextSem / 2);
      student.passedout = false;

      await student.save({ session });
    }

    return {
      matchedStudents: students.length,
      depromotedStudents: students.length,
      trackingUpdated: false,
    };
  });
};

module.exports = {
  BULK_VALID_QUOTAS,
  BULK_VALID_EDUCATION_TYPES,
  BULK_VALID_DEGREE_PROGRAMS,
  BULK_VALID_DEPARTMENTS,
  upsertTrackingRowsForStudent,
  triggerBulkFeeTrackingRefresh,
  triggerPromotion,
  triggerDepromotion,
};
