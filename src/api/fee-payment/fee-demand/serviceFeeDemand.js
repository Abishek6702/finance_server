 const Student = require("../../student/students-management/modelStudent");
 const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
 const AppError = require("../../../utils/appError");
 
 const normalizeMoney = (value) => {
   const n = Number(value);
   if (!Number.isFinite(n) || n < 0) return 0;
   return Math.round(n * 100) / 100;
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
   currentAcademicYear: s.academic?.currentAcademicYear,
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

const buildStudentTypeInfo = (s) => {
  const transport = s.transport?.isApplicable === true;
  const hostel = s.hostel?.isApplicable === true;

  return {
    transport,
    hostel,
    transportDetails: transport
      ? {
          transport: s.transport?.transport,
          route: s.transport?.route,
          busNo: s.transport?.busNo,
          stop: s.transport?.stop,
          fee: s.transport?.fee ?? 0,
        }
      : null,
    hostelDetails: hostel
      ? {
          hostel: s.hostel?.hostel,
          block: s.hostel?.block,
          sharing: s.hostel?.sharing,
          isAttached: s.hostel?.isAttached,
          fee: s.hostel?.fee ?? 0,
        }
      : null,
  };
};

const buildStudentTypeInfoForAcademicYear = (student, yearRecord) => {
  const transport = student.transport?.isApplicable === true;
  const hostel = student.hostel?.isApplicable === true;

  const transportSnapshot = yearRecord?.transport || {};
  const transportPaid = normalizeMoney(transportSnapshot.total?.paid || 0);
  const transportConcession = normalizeMoney(yearRecord?.concessions?.transport || 0);

  return {
    transport,
    hostel,
    transportDetails: transport
      ? {
          transport: transportSnapshot.transport || student.transport?.transport || "",
          route: transportSnapshot.route || student.transport?.route || "",
          busNo: transportSnapshot.busNo || student.transport?.busNo || "",
          stop: transportSnapshot.stop || student.transport?.stop || "",
          fee: normalizeMoney(transportSnapshot.fee ?? student.transport?.fee ?? 0),
          paid: transportPaid,
          consession: transportConcession,
        }
      : null,
    hostelDetails: null,
  };
};
 
 /* ────────────────────────────────────────────────
    API 1: GET /FeeDemand
    Summary list with optional filters
 ──────────────────────────────────────────────── */
 const getFeeDemandList = async (query = {}) => {
  const { rollNo, batch, department, academicYear, studyingYear } = query;

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
      "academic.departmentName academic.section academic.yearStudying academic.currentAcademicYear " +
      "transport.isApplicable " +
      "hostel.isApplicable"
    )
    .lean();

  if (!students.length) return { data: [], totalRecords: 0 };

  let filteredStudents = students;

  if (academicYear) {
    const rollNos = students.map((s) => s.personal?.rollNo).filter(Boolean);

    const trackings = await StudentFeeTracking.find({
      rollNo: { $in: rollNos },
      "academicYearWiseRecord.academicYear": academicYear,
    })
      .select("rollNo")
      .lean();

    const allowedRollNos = new Set(trackings.map((t) => t.rollNo));
    filteredStudents = students.filter((s) => allowedRollNos.has(s.personal?.rollNo));
  }

  const data = filteredStudents.map((s) => {
    const { transport, hostel } = buildStudentTypeInfo(s);

    return {
      student: {
        rollNo: s.personal?.rollNo,
        name: s.personal?.studentName,
        photo: s.personal?.studentPhoto,
        department: s.academic?.departmentName,
        year: s.academic?.yearStudying,
        section: s.academic?.section,
        currentAcademicYear: s.academic?.currentAcademicYear,
      },
      studentType: {
        transport,
        hostel,
      },
    };
  });

  return { data, totalRecords: data.length };
};
 /* ────────────────────────────────────────────────
    API 2: GET /FeeDemand/:rollNo
    Year-wise fee summary for a student
 ──────────────────────────────────────────────── */
 const getFeeDemandByRollNo = async (rollNo, query = {}) => {
   const normalizedRoll = rollNo.toUpperCase();
   const academicYear = query.academicYear;

   const student = await Student.findOne({ "personal.rollNo": normalizedRoll }).lean();
   if (!student) throw new AppError("Student not found", 404);

   const tracking = await StudentFeeTracking.findOne({ rollNo: normalizedRoll })
     .select("academicYearWiseRecord")
     .lean();

   const yearRecord = (tracking?.academicYearWiseRecord || []).find(
     (entry) => entry.academicYear === academicYear
   );

   if (!yearRecord) {
     throw new AppError(`No fee tracking record found for academicYear ${academicYear}`, 404);
   }

   return {
     rollNo: student.personal?.rollNo || "",
     name: student.personal?.studentName || "",
     photo: student.personal?.studentPhoto || "",
     department: student.academic?.departmentName || "",
     section: student.academic?.section || "",
     batch: student.academic?.batch || "",
     currentAcademicYear: student.academic?.currentAcademicYear || "",
     studentType: buildStudentTypeInfoForAcademicYear(student, yearRecord),
   };
 };
  
 
 module.exports = {
   getFeeDemandList,
   getFeeDemandByRollNo, 
 };
 
 