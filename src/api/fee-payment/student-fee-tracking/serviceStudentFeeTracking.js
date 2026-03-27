const StudentFeeTracking = require("./modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");
const FeeStructureMaster = require("../../fee-structure/acadamic/modelAcadamic");
const { Transport } = require("../../fee-structure/transport/modelTransport");
const { Hostel } = require("../../fee-structure/hostel/modelHostel");
const mongoose = require("mongoose");
const AppError = require("../../../utils/appError");

const MAX_SEMESTER = 8;

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const computeStatus = (demand, paid) => {
  if (demand === 0) return "Paid";
  if (paid >= demand) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
};

const buildFacilityArray = (yr) => {
  const facility = [];
  if (yr.transport && (yr.transport.subTotal || 0) > 0) {
    const tTotal = normalizeMoney(yr.transport.total?.total || 0);
    const tPaid = normalizeMoney(yr.transport.total?.paid || 0);
    facility.push({
      name: "Transport Fees",
      isActive: yr.transport.isActive !== false,
      consumedAmount: normalizeMoney(yr.transport.consumedAmount || 0),
      effectiveDate: yr.transport.effectiveDate || null,
      endDate: yr.transport.endDate || null,
      total: tTotal,
      concession: normalizeMoney(yr.concessions?.transport || 0),
      paid: tPaid,
      overdue: normalizeMoney(Math.max(0, tTotal - tPaid)),
      status: yr.transport.total?.status || computeStatus(tTotal, tPaid)
    });
  }
  if (yr.hostel && (yr.hostel.subTotal || 0) > 0) {
    const hTotal = normalizeMoney(yr.hostel.total?.total || 0);
    const hPaid = normalizeMoney(yr.hostel.total?.paid || 0);
    facility.push({
      name: "Hostel Fees",
      isActive: yr.hostel.isActive !== false,
      consumedAmount: normalizeMoney(yr.hostel.consumedAmount || 0),
      effectiveDate: yr.hostel.effectiveDate || null,
      endDate: yr.hostel.endDate || null,
      total: hTotal,
      concession: normalizeMoney(yr.concessions?.hostel || 0),
      paid: hPaid,
      overdue: normalizeMoney(Math.max(0, hTotal - hPaid)),
      status: yr.hostel.total?.status || computeStatus(hTotal, hPaid)
    });
  }
  return facility;
};

/* ────────────────────────────────────────────────
   Helper: Hide block data if isApplicable === false
   Keeps only { isApplicable: false }
──────────────────────────────────────────────── */
const cleanApplicableBlock = (block) => {
  if (!block) return null;

  if (block.isApplicable === false) {
    return { isApplicable: false };
  }

  return block;
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

const getYearsToBackfill = (student) => {
  const batchStart = parseInt(student?.academic?.batch?.split("-")[0], 10);
  const currentYearStart = parseInt(student?.academic?.currentAcademicYear?.split("-")[0], 10);

  if (!Number.isFinite(batchStart) || !Number.isFinite(currentYearStart) || currentYearStart < batchStart) {
    return [];
  }

  const years = [];

  for (let yearStart = batchStart; yearStart <= currentYearStart; yearStart++) {
    const studyYear = yearStart - batchStart + 1;
    const oddSemNo = studyYear * 2 - 1;
    const evenSemNo = studyYear * 2;
    if (oddSemNo < 1 || evenSemNo > MAX_SEMESTER) break;
    years.push(`${yearStart}-${yearStart + 1}`);
  }

  return years;
};

const buildAcademicYearTrackingRow = async (student, feeStructure, academicYear) => {
  const batchStart = parseInt(student?.academic?.batch?.split("-")[0], 10);
  const yearStart = parseInt(academicYear.split("-")[0], 10);

  if (!Number.isFinite(batchStart) || !Number.isFinite(yearStart)) return null;

  const studyYear = yearStart - batchStart + 1;
  const oddSemNo = studyYear * 2 - 1;
  const evenSemNo = studyYear * 2;
  if (oddSemNo < 1 || evenSemNo > MAX_SEMESTER) return null;

  const dept = findMatchingDepartment(feeStructure, student);
  if (!dept) return null;

  const oddSemester = dept.semesters?.find((s) => s.isActive && s.semesterNumber === oddSemNo);
  const evenSemester = dept.semesters?.find((s) => s.isActive && s.semesterNumber === evenSemNo);
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
 
/* ────────────────────────────────────────────────
 
   feeDetails frotnend friendly
   
──────────────────────────────────────────────── */
const getStudentsFeeTrackingData2 = async (query = {}) => {
  const search = {};
  if (query.batch) {
    search["academic.batch"] = query.batch;
  }

  if (query.department) {
    search["academic.departmentName"] = {
      $regex: new RegExp(`^${query.department}$`, "i"),
    };
  }

  if (query.rollNo) {
    search["personal.rollNo"] = query.rollNo.toUpperCase();
  }

  /* ────────────────────────────────────────────────
     Fetch ONLY required fields
  ──────────────────────────────────────────────── */
  const students = await Student.find(search) 
    .lean();

  if (!students.length) return [];

  const rollNos = students
    .map((s) => s.personal?.rollNo)
    .filter(Boolean);

  const trackings = await StudentFeeTracking.find({
    rollNo: { $in: rollNos },
  }).lean();

  const trackingMap = trackings.reduce((acc, t) => {
    acc[t.rollNo] = t;
    return acc;
  }, {});

  const computeStatus = (demand, paid) => {
    if (demand === 0) return "Paid";
    if (paid >= demand) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  };

  const ACADEMIC_HEADS = ["tuition", "exam", "erp", "book", "lab"];

  const HEAD_LABELS = {
    tuition: "Tuition Fees",
    exam: "Exam Fees",
    erp: "ERP Fees",
    book: "Book Fees",
    lab: "Lab Fees",
  };

  const buildStudentProfile = (s) => ({
    rollNo: s.personal?.rollNo,
    name: s.personal?.studentName,
    photo: s.personal?.studentPhoto,
    department: s.academic?.departmentName,
    section: s.academic?.section,
    batch: s.academic?.batch,
    currentAcademicYear: s.academic?.currentAcademicYear,
  });

  const buildContactPerson = (person) => {
    const name = person?.name || null;
    const phoneNumber = person?.mobile || null;
    if (!name && !phoneNumber) return {};
    return { name, phoneNumber };
  };

  const buildContactBlock = (s) => ({
    student: {
      mobile: s.contact?.selfMobileNo || null,
      email: s.contact?.selfEmail || null,
    },
    father: buildContactPerson(s.family?.father),
    mother: buildContactPerson(s.family?.mother),
    guardian: buildContactPerson(s.family?.guardian),
  });

  const buildOverall = ({ demand, concession, paid, total, status, studentType }) => {
    const overdue = normalizeMoney(Math.max(0, demand - paid));
    const overall = {
      demand: normalizeMoney(demand),
      concession: normalizeMoney(concession),
      paid: normalizeMoney(paid),
      overdue,
      status,
      total: normalizeMoney(total),
    };

    if (studentType) {
      overall.studentType = studentType;
    }

    return overall;
  };

  const parseAcademicYearStart = (year) => {
    const start = parseInt(String(year || "").split("-")[0], 10);
    return Number.isFinite(start) ? start : 0;
  };

  /* ────────────────────────────────────────────────
     Shape Final Response
  ──────────────────────────────────────────────── */
  return students.map((s) => {
    const tracking = trackingMap[s.personal?.rollNo];
    const yearRecords = [...(tracking?.academicYearWiseRecord || [])].sort(
      (a, b) => parseAcademicYearStart(a.academicYear) - parseAcademicYearStart(b.academicYear)
    );

    const studentType = {
      transport: s.transport?.isApplicable === true,
      hostel: s.hostel?.isApplicable === true,
    };

    const feeSummary = yearRecords.map((yr) => {
      const demand = normalizeMoney(yr.total?.total || 0);
      const paid = normalizeMoney(yr.total?.paid || 0);
      const concession = normalizeMoney(
        (yr.concessions?.totalConcession || 0) + (yr.hostel?.hostelSpecialConcession || 0)
      );
      const total = normalizeMoney(yr.subTotal || 0);

      return {
        academicYear: yr.academicYear,
        community: s.personal?.community,
        demand,
        concession,
        paid,
        overdue: normalizeMoney(Math.max(0, demand - paid)),
        status: computeStatus(demand, paid),
        total,
        studentType,
      };
    });

    const overallRaw = feeSummary.reduce(
      (acc, yr) => {
        acc.demand += yr.demand;
        acc.concession += yr.concession;
        acc.paid += yr.paid;
        acc.total += yr.total;
        return acc;
      },
      { demand: 0, concession: 0, paid: 0, total: 0 }
    );

    const overall = buildOverall({
      demand: overallRaw.demand,
      concession: overallRaw.concession,
      paid: overallRaw.paid,
      total: overallRaw.total,
      status: computeStatus(
        normalizeMoney(overallRaw.demand),
        normalizeMoney(overallRaw.paid)
      ),
    });

    const buildSemesterDetail = (sem) => {
      if (!sem) return null;

      const feeHeads = ACADEMIC_HEADS.map((head) => {
        const comp = sem[head] || {};
        const total = normalizeMoney(comp.total || 0);
        const paid = normalizeMoney(comp.paid || 0);
        const concession = normalizeMoney(comp.concession || 0);
        return {
          name: HEAD_LABELS[head],
          total,
          concession,
          paid,
          overdue: normalizeMoney(Math.max(0, total - paid)),
          status: comp.status || computeStatus(total, paid),
        };
      });

      const demand = normalizeMoney(sem.total?.total || 0);
      const paid = normalizeMoney(sem.total?.paid || 0);
      const total = normalizeMoney(sem.subTotal || 0);
      const concession = normalizeMoney(Math.max(0, total - demand));

      return {
        semesterNumber: sem.semesterNumber,
        feeHeads,
        overall: buildOverall({
          demand,
          concession,
          paid,
          total,
          status: sem.total?.status || computeStatus(demand, paid),
          studentType,
        }),
      };
    };

    const academicYears = yearRecords.map((yr) => {
      const demand = normalizeMoney(yr.total?.total || 0);
      const paid = normalizeMoney(yr.total?.paid || 0);
      const total = normalizeMoney(yr.subTotal || 0);
      const concession = normalizeMoney(Math.max(0, total - demand));

      return {
        academicYear: yr.academicYear,
        odd: buildSemesterDetail(yr.academic?.odd),
        even: buildSemesterDetail(yr.academic?.even),
        overall: buildOverall({
          demand,
          concession,
          paid,
          total,
          status: yr.total?.status || computeStatus(demand, paid),
          studentType,
        }),
      };
    });

    return {
      studentCurrentAcademicYear: s.academic?.currentAcademicYear || null,
      feeAcademicYears: feeSummary.map((entry) => entry.academicYear),
      feeSummary,
      overall,
      student: buildStudentProfile(s),
      contact: buildContactBlock(s),
      academicYears,
    };
  });
};



/* ────────────────────────────────────────────────
   GET / — get student(s) data + fee tracking records
   Filters: batch, department, rollNo
──────────────────────────────────────────────── */
const getStudentsFeeTrackingData = async (query = {}) => {
  const search = {};
  if (query.batch) {
    search["academic.batch"] = query.batch;
  }

  if (query.department) {
    search["academic.departmentName"] = {
      $regex: new RegExp(`^${query.department}$`, "i"),
    };
  }

  if (query.rollNo) {
    search["personal.rollNo"] = query.rollNo.toUpperCase();
  }

  /* ────────────────────────────────────────────────
     Fetch ONLY required fields
  ──────────────────────────────────────────────── */
  const students = await Student.find(search) 
    .lean();

  if (!students.length) return [];

  const rollNos = students
    .map((s) => s.personal?.rollNo)
    .filter(Boolean);

  const trackings = await StudentFeeTracking.find({
    rollNo: { $in: rollNos },
  }).lean();

  const trackingMap = trackings.reduce((acc, t) => {
    acc[t.rollNo] = t;
    return acc;
  }, {});

  /* ────────────────────────────────────────────────
     Remove redundant internal fields from tracking
  ──────────────────────────────────────────────── */
const stripTracking = (t) => {
  if (!t) return null;

  const { _id, student, __v, rollNo, ...rest } = t;
  
  if (rest.academicYearWiseRecord && Array.isArray(rest.academicYearWiseRecord)) {
    rest.academicYearWiseRecord = rest.academicYearWiseRecord.map((yr) => {
      const facility = buildFacilityArray(yr);
      return { ...yr, facility };
    });
  }

  return rest;
};
  /* ────────────────────────────────────────────────
     Shape Final Response
  ──────────────────────────────────────────────── */
  return students.map((s) => ({
    student: {
      personal: {
        rollNo: s.personal?.rollNo,
        studentName: s.personal?.studentName,
        gender: s.personal?.gender,
        studentPhoto: s.personal?.studentPhoto,
      },

      academic: s.academic,
      contact: s.contact,

      enrollment: s.enrollment
        ? {
            quota: s.enrollment?.quota,

            firstGraduate: cleanApplicableBlock(
              s.enrollment?.firstGraduate
            ),
            scheme7point5: cleanApplicableBlock(
              s.enrollment?.scheme7point5
            ),
            pmssScheme: cleanApplicableBlock(
              s.enrollment?.pmssScheme
            ),
            sakthiScheme: cleanApplicableBlock(
              s.enrollment?.sakthiScheme
            ),
            specialConcession: cleanApplicableBlock(
              s.enrollment?.specialConcession
            ),
          }
        : null,

      transport: cleanApplicableBlock(s.transport),
      hostel: cleanApplicableBlock(s.hostel),
    },

    feeTracking: stripTracking(
      trackingMap[s.personal?.rollNo] || null
    ),
  }));
};



/* ────────────────────────────────────────────────
   POST /backfill — append missing year rows for all students
   (idempotent, append-only, does not alter existing rows)
──────────────────────────────────────────────── */
const backfillAllStudentFeeTracking = async () => {
  const students = await Student.find({}).lean();

  const summary = {
    studentsScanned: students.length,
    trackingDocsCreated: 0,
    studentsUpdated: 0,
    rowsAppended: 0,
    rowsAlreadyPresent: 0,
    skippedNoFeeStructure: 0,
    skippedNoMatchingAcademicStructure: 0,
  };

  if (!students.length) return summary;

  const studentYearsMap = new Map();
  const allYears = new Set();

  for (const student of students) {
    const years = getYearsToBackfill(student);
    studentYearsMap.set(String(student._id), years);
    years.forEach((year) => allYears.add(year));
  }

  const feeStructures = await FeeStructureMaster.find({
    academicYear: { $in: [...allYears] },
    isActive: true
  }).lean();
  const feeStructureMap = new Map(feeStructures.map((fs) => [fs.academicYear, fs]));

  const trackingDocs = await StudentFeeTracking.find({
    student: { $in: students.map((student) => student._id) }
  });
  const trackingMap = new Map(trackingDocs.map((tracking) => [String(tracking.student), tracking]));

  for (const student of students) {
    let tracking = trackingMap.get(String(student._id));
    if (!tracking) {
      tracking = new StudentFeeTracking({
        student: student._id,
        rollNo: student.personal?.rollNo,
        academicYearWiseRecord: []
      });
      trackingMap.set(String(student._id), tracking);
      summary.trackingDocsCreated++;
    }

    const years = studentYearsMap.get(String(student._id)) || [];
    let studentChanged = false;

    for (const academicYear of years) {
      const alreadyExists = tracking.academicYearWiseRecord.some((row) => row.academicYear === academicYear);
      if (alreadyExists) {
        summary.rowsAlreadyPresent++;
        continue;
      }

      const feeStructure = feeStructureMap.get(academicYear);
      if (!feeStructure) {
        summary.skippedNoFeeStructure++;
        continue;
      }

      const row = await buildAcademicYearTrackingRow(student, feeStructure, academicYear);
      if (!row) {
        summary.skippedNoMatchingAcademicStructure++;
        continue;
      }

      tracking.academicYearWiseRecord.push(row);
      studentChanged = true;
      summary.rowsAppended++;
    }

    if (studentChanged) {
      tracking.markModified("academicYearWiseRecord");
      await tracking.save();
      summary.studentsUpdated++;
    }
  }

  return summary;
};

module.exports = {
  getStudentsFeeTrackingData,
  getStudentsFeeTrackingData2,
  backfillAllStudentFeeTracking,
};