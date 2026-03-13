const Student = require("../../student/students-management/modelStudent");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const AppError = require("../../../utils/appError");

const normalizeMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

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
  transport: "Transport Fees",
  hostel: "Hostel Fees",
};

const buildStudentProfile = (s) => ({
  rollNo: s.personal?.rollNo,
  name: s.personal?.studentName,
  photo: s.personal?.studentPhoto,
  department: s.academic?.departmentName,
  section: s.academic?.section,
  batch: s.academic?.batch,
});

const buildContactBlock = (s) => ({
  student: {
    mobile: s.contact?.selfMobileNo,
    email: s.contact?.selfEmail,
  },
  father: {
    name: s.family?.father?.name,
    phoneNumber: s.family?.father?.mobile,
  },
  mother: {
    name: s.family?.mother?.name,
    phoneNumber: s.family?.mother?.mobile,
  },
  guardian: {
    name: s.family?.guardian?.name,
    phoneNumber: s.family?.guardian?.mobile,
  },
});

/* ────────────────────────────────────────────────
   API 1: GET /feedetails
   Summary list with optional filters
──────────────────────────────────────────────── */
const getFeeDetailsList = async (query = {}) => {
  const { rollNo, batch, department, academicYear ,studyingYear } = query;

  const studentFilter = {};
  if (rollNo) studentFilter["personal.rollNo"] = rollNo.toUpperCase();
  if (batch) studentFilter["academic.batch"] = batch;
  if (studyingYear) studentFilter["academic.yearStudying"] = Number(studyingYear);
  if (department) {
    studentFilter["academic.departmentName"] = {
      $regex: new RegExp(`^${department}$`, "i"),
    };
  }

  const students = await Student.find(studentFilter)
    .select(
      "personal.rollNo personal.studentName personal.studentPhoto " +
      "academic.departmentName academic.yearStudying academic.currentAcademicYear " +
      "transport.isApplicable hostel.isApplicable"
    )
    .lean();

  if (!students.length) return { data: [], totalRecords: 0 };

  const rollNos = students.map((s) => s.personal?.rollNo).filter(Boolean);

  const trackings = await StudentFeeTracking.find({ rollNo: { $in: rollNos } })
    .select("rollNo academicYearWiseRecord.academicYear academicYearWiseRecord.total academicYearWiseRecord.concessions")
    .lean();

  const trackingMap = trackings.reduce((acc, t) => {
    acc[t.rollNo] = t;
    return acc;
  }, {});

  const data = students.map((s) => {
    const tracking = trackingMap[s.personal?.rollNo];
    const yearRecords = tracking?.academicYearWiseRecord || [];

    const records = academicYear
      ? yearRecords.filter((yr) => yr.academicYear === academicYear)
      : yearRecords;

    let demand = 0;
    let paid = 0;
    let concession = 0;

    records.forEach((yr) => {
      demand += yr.total?.total || 0;
      paid += yr.total?.paid || 0;
      concession += yr.concessions?.totalConcession || 0;
    });

    demand = normalizeMoney(demand);
    paid = normalizeMoney(paid);
    concession = normalizeMoney(concession);
    const overdue = normalizeMoney(Math.max(0, demand - paid));

    return {
      student: {
        rollNo: s.personal?.rollNo,
        name: s.personal?.studentName,
        photo: s.personal?.studentPhoto,
        department: s.academic?.departmentName,
        year: s.academic?.yearStudying,
        currentAcademicYear: s.academic?.currentAcademicYear,
      },
      fee: {
        demand,
        concession,
        paid,
        overdue,
        status: computeStatus(demand, paid),
      },
      studentType: {
        transport: s.transport?.isApplicable === true,
        hostel: s.hostel?.isApplicable === true,
      },
    };
  });

  return { data, totalRecords: data.length };
};

/* ────────────────────────────────────────────────
   API 2: GET /feedetails/:rollNo
   Year-wise fee summary for a student
──────────────────────────────────────────────── */
const getFeeDetailsByRollNo = async (rollNo, query = {}) => {
  const includeProfile = query.includeProfile !== "false";
  const normalizedRoll = rollNo.toUpperCase();

  const student = await Student.findOne({ "personal.rollNo": normalizedRoll }).lean();
  if (!student) throw new AppError("Student not found", 404);

  const tracking = await StudentFeeTracking.findOne({ rollNo: normalizedRoll }).lean();
  const yearRecords = tracking?.academicYearWiseRecord || [];

  const feeSummary = yearRecords.map((yr) => {
    const demand = normalizeMoney(yr.total?.total || 0);
    const paid = normalizeMoney(yr.total?.paid || 0);
    const concession = normalizeMoney(yr.concessions?.totalConcession || 0);
    const overdue = normalizeMoney(Math.max(0, demand - paid));

    return {
      academicYear: yr.academicYear,
      community: student.personal?.community,
      demand,
      concession,
      paid,
      overdue,
      status: computeStatus(demand, paid),
      total: normalizeMoney(yr.subTotal || 0),
      studentType: {
        transport: student.transport?.isApplicable === true,
        hostel: student.hostel?.isApplicable === true,
      },
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

  const overall = {
    demand: normalizeMoney(overallRaw.demand),
    concession: normalizeMoney(overallRaw.concession),
    paid: normalizeMoney(overallRaw.paid),
    overdue: normalizeMoney(Math.max(0, overallRaw.demand - overallRaw.paid)),
    status: computeStatus(
      normalizeMoney(overallRaw.demand),
      normalizeMoney(overallRaw.paid)
    ),
    total: normalizeMoney(overallRaw.total),
  };

  const result = { feeSummary, overall };

  if (includeProfile) {
    result.student = buildStudentProfile(student);
    result.contact = buildContactBlock(student);
  }

  return result;
};

/* ────────────────────────────────────────────────
   API 3: GET /feedetails/:rollNo/:academicYear
   Semester-level fee breakdown for one academic year
──────────────────────────────────────────────── */
const getFeeDetailsBySemester = async (rollNo, academicYear, query = {}) => {
  const includeProfile = query.includeProfile !== "false";
  const semesterFilter = query.semester?.toLowerCase() || null;
  const normalizedRoll = rollNo.toUpperCase();

  const student = await Student.findOne({ "personal.rollNo": normalizedRoll }).lean();
  if (!student) throw new AppError("Student not found", 404);

  const tracking = await StudentFeeTracking.findOne({ rollNo: normalizedRoll }).lean();
  if (!tracking) throw new AppError("Fee tracking record not found for this student", 404);

  const yearRecord = tracking.academicYearWiseRecord.find(
    (yr) => yr.academicYear === academicYear
  );
  if (!yearRecord) throw new AppError(`Academic year ${academicYear} not found in fee tracking`, 404);

  const hasTransport = student.transport?.isApplicable === true;
  const hasHostel = student.hostel?.isApplicable === true;

  /* ── Build feeHeads array for one semester ── */
  const buildFeeHeads = (sem, attachTransport, attachHostel) => {
    const heads = [];
    if (!sem) return heads;

    ACADEMIC_HEADS.forEach((f) => {
      const comp = sem[f];
      if (!comp || (comp.subTotal === 0 && (comp.total === 0 || comp.total === undefined))) return;
      const total = normalizeMoney(comp.total || 0);
      const concession = normalizeMoney(comp.concession || 0);
      const paid = normalizeMoney(comp.paid || 0);
      const overdue = normalizeMoney(Math.max(0, total - paid));
      heads.push({
        name: HEAD_LABELS[f],
        total,
        concession,
        paid,
        overdue,
        status: computeStatus(total, paid),
      });
    });

    if (attachTransport && (yearRecord.transport?.subTotal || 0) > 0) {
      const t = yearRecord.transport;
      const total = normalizeMoney(t.total?.total || 0);
      const paid = normalizeMoney(t.total?.paid || 0);
      const overdue = normalizeMoney(Math.max(0, total - paid));
      heads.push({
        name: HEAD_LABELS.transport,
        total,
        concession: normalizeMoney(yearRecord.concessions?.transport || 0),
        paid,
        overdue,
        status: computeStatus(total, paid),
      });
    }

    if (attachHostel && (yearRecord.hostel?.subTotal || 0) > 0) {
      const h = yearRecord.hostel;
      const total = normalizeMoney(h.total?.total || 0);
      const paid = normalizeMoney(h.total?.paid || 0);
      const overdue = normalizeMoney(Math.max(0, total - paid));
      heads.push({
        name: HEAD_LABELS.hostel,
        total,
        concession: normalizeMoney(yearRecord.concessions?.hostel || 0),
        paid,
        overdue,
        status: computeStatus(total, paid),
      });
    }

    return heads;
  };

  /* ── Build the full semester block ── */
  const buildSemesterBlock = (type, sem, attachTransport, attachHostel) => {
    const semType = type.charAt(0).toUpperCase() + type.slice(1);
    const studentType = { transport: hasTransport, hostel: hasHostel };

    if (!sem) {
      return {
        semesterType: semType,
        semesterNumber: null,
        overall: {
          demand: 0,
          concession: 0,
          paid: 0,
          overdue: 0,
          status: "Unpaid",
          total: 0,
          studentType,
        },
        feeHeads: [],
      };
    }

    const feeHeads = buildFeeHeads(sem, attachTransport, attachHostel);

    let demand = normalizeMoney(sem.total?.total || 0);
    let paid = normalizeMoney(sem.total?.paid || 0);
    let concession = normalizeMoney(
      ACADEMIC_HEADS.reduce((sum, f) => sum + (sem[f]?.concession || 0), 0)
    );
    let grossTotal = normalizeMoney(sem.subTotal || 0);

    if (attachTransport && (yearRecord.transport?.subTotal || 0) > 0) {
      demand = normalizeMoney(demand + (yearRecord.transport.total?.total || 0));
      paid = normalizeMoney(paid + (yearRecord.transport.total?.paid || 0));
      concession = normalizeMoney(concession + (yearRecord.concessions?.transport || 0));
      grossTotal = normalizeMoney(grossTotal + (yearRecord.transport.subTotal || 0));
    }

    if (attachHostel && (yearRecord.hostel?.subTotal || 0) > 0) {
      demand = normalizeMoney(demand + (yearRecord.hostel.total?.total || 0));
      paid = normalizeMoney(paid + (yearRecord.hostel.total?.paid || 0));
      concession = normalizeMoney(concession + (yearRecord.concessions?.hostel || 0));
      grossTotal = normalizeMoney(grossTotal + (yearRecord.hostel.subTotal || 0));
    }

    const overdue = normalizeMoney(Math.max(0, demand - paid));

    return {
      semesterType: semType,
      semesterNumber: sem.semesterNumber,
      overall: {
        demand,
        concession,
        paid,
        overdue,
        status: computeStatus(demand, paid),
        total: grossTotal,
        studentType,
      },
      feeHeads,
    };
  };

  const semesters = [];

  if (!semesterFilter || semesterFilter === "odd") {
    semesters.push(
      buildSemesterBlock("Odd", yearRecord.academic?.odd, hasTransport, hasHostel)
    );
  }

  if (!semesterFilter || semesterFilter === "even") {
    semesters.push(
      buildSemesterBlock("Even", yearRecord.academic?.even, false, false)
    );
  }

  const result = { academicYear, semesters };

  if (includeProfile) {
    result.student = buildStudentProfile(student);
    result.contact = buildContactBlock(student);
  }

  return result;
};

module.exports = {
  getFeeDetailsList,
  getFeeDetailsByRollNo,
  getFeeDetailsBySemester,
};
