/**
 * Shared test setup: context, helpers, lifecycle hooks.
 * Every module-level test file imports from here.
 */
require("dotenv").config();
const request = require("supertest");
const Student = require("../api/students/model.student");
const FeeStructureMaster = require("../api/feeStructure/model.feeStructureMaster");
const StudentTransaction = require("../api/transaction/model.studentTransaction");
const StudentFeeTracking = require("../api/studentFeeTracking/model.studentFeeTracking");
const ReceiptRecallRequest = require("../api/receiptRecall/model.receiptRecall");
const ActivityLog = require("../models/ActivityLog");
const { Transport } = require("../api/transport/model.transport");
const { Hostel } = require("../api/hostel/model.hostel");
const { app, startServer, stopServer } = require("../server");

jest.setTimeout(180000);

/* ======================================================
   UNIQUE TIMESTAMP for test isolation
====================================================== */
const TS = String(Date.now());
const yearStart = 2600 + Number(TS.slice(-2));
const toAcademicYear = (startYear) => `${startYear}-${startYear + 1}`;

const testCtx = {
  superadminToken: "",
  adminToken: "",
  academicYearPrimary: toAcademicYear(yearStart),
  academicYearSecondary: toAcademicYear(yearStart + 1),
  academicYearMissing: toAcademicYear(yearStart + 40),
  studentRollCrud: `12CS${TS.slice(-3)}`,
  studentRollFinance: `13CS${TS.slice(-3)}`,
  studentRollHostel: `16CS${TS.slice(-3)}`,
  studentRollTransport: `14CS${TS.slice(-3)}`,
  studentRollDual: `15CS${TS.slice(-3)}`,
  bulkRollA: `17CS${TS.slice(-3)}`,
  bulkRollB: `18CS${TS.slice(-3)}`,
  bulkRollC: `19CS${TS.slice(-3)}`,
  receiptOne: `REC${TS.slice(-6)}A`,
  receiptTwo: `REC${TS.slice(-6)}B`,
  receiptThree: `REC${TS.slice(-6)}C`,
  receiptFour: `REC${TS.slice(-6)}D`,
  receiptRecall: `REC${TS.slice(-6)}R`,
  studentRollRecall: `20CS${TS.slice(-3)}`,
  testTransportId: null,
  testHostelId: null,
  TS,
};

/* ======================================================
   BUILDER HELPERS
====================================================== */
const buildSemesterFee = (semesterNumber, baseTuition) => ({
  semesterNumber,
  tuition: { fee: baseTuition },
  exam: { fee: 2000 },
  erp: { fee: 500 },
  book: { fee: 1000 },
  lab: { fee: 1500 },
  total: { fee: baseTuition + 2000 + 500 + 1000 + 1500 },
  isActive: true,
});

const buildFeeStructurePayload = (year, { isActive = true } = {}) => {
  const semesters = Array.from({ length: 8 }, (_, idx) =>
    buildSemesterFee(idx + 1, 40000 + idx * 1000)
  );
  const academicDepartmentTotal = semesters.reduce((s, sem) => s + (sem.total?.fee || 0), 0);
  return {
    academicYear: year,
    academicStructures: [
      {
        quota: "Government Quota",
        educationType: "UG",
        degreeProgram: "BE",
        departments: [
          { departmentName: "CSE", semesters, total: { fee: academicDepartmentTotal }, isActive: true },
        ],
        total: { fee: academicDepartmentTotal },
        isActive: true,
      },
    ],
    hostelStructures: [
      {
        block: "A-BLOCK",
        roomType: { sharingType: "Three", isAttached: true },
        roomFee: { fee: 30000 },
        messFee: { fee: 18000 },
        maintenanceFee: { fee: 5000 },
        total: { fee: 53000 },
        isActive: true,
      },
    ],
    total: { fee: academicDepartmentTotal + 53000 },
    isActive,
  };
};

const buildStudentPayload = (rollNo, { academicYear, transport, hostel, enrollment } = {}) => ({
  personal: {
    rollNo,
    studentName: "Jest Tester",
    gender: "Male",
    dob: "2007-05-15",
    bloodGroup: "O+",
    aadharNo: `9999${TS.slice(-8)}`,
    emisNo: `EMIS${TS.slice(-6)}`,
    religion: "Hindu",
    community: "BC",
    casteName: "Kongu Vellalar",
    nationality: "Indian",
    studentPhoto: "https://example.com/student-photo.jpg",
  },
  academic: {
    educationType: "UG",
    academicType: "REG",
    isLateralEntry: false,
    degreeProgram: "BE",
    departmentName: "CSE",
    yearStudying: 1,
    currentSemesterNumber: 1,
    section: "A",
    batch: academicYear,
    currentAcademicYear: academicYear,
  },
  contact: {
    selfMobileNo: "9876543210",
    selfEmail: `${rollNo.toLowerCase()}@mail.com`,
    officialEmail: `${rollNo.toLowerCase()}@sece.ac.in`,
  },
  family: {
    father: { name: "Father", mobile: "9876500001", workType: "Farmer", qualification: "Diploma" },
    mother: { name: "Mother", mobile: "9876500002", workType: "Homemaker", qualification: "HSC" },
    guardian: { name: "Guardian", mobile: "9876500003" },
    familyIncomeAsPerCertificate: 180000,
    communityCertificateNo: `CC${TS.slice(-8)}`,
  },
  address: {
    permanent: { doorNo: "12/4", street: "Main Road", taluk: "Pollachi", district: "Coimbatore", state: "Tamil Nadu", pincode: "641001" },
    communication: { doorNo: "12/4", street: "Main Road", taluk: "Pollachi", district: "Coimbatore", state: "Tamil Nadu", pincode: "641001" },
  },
  enrollment: enrollment || {
    quota: "Government Quota",
    firstGraduate: { isApplicable: false },
    scheme7point5: { isApplicable: false },
    pmssScheme: { isApplicable: false },
    sakthiScheme: { isApplicable: false },
    specialConcession: { isApplicable: false },
  },
  transport: transport || { isApplicable: false },
  hostel: hostel || { isApplicable: false },
});

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const superadminAuth = () => authHeader(testCtx.superadminToken);
const adminAuth = () => authHeader(testCtx.adminToken);

/* ======================================================
   CSV / XLSX HELPERS (for bulk tests)
====================================================== */
const xlsx = require("xlsx");

const CSV_HEADERS = [
  "rollNo","studentName","gender","dob","bloodGroup","aadharNo","emisNo",
  "religion","community","casteName","nationality","studentPhoto",
  "educationType","academicType","isLateralEntry","departmentName",
  "degreeProgram","yearStudying","currentSemesterNumber","section",
  "batch","currentAcademicYear",
  "selfMobileNo","selfEmail","officialEmail",
  "fatherName","fatherMobile","fatherWorkType","fatherQualification",
  "motherName","motherMobile","motherWorkType","motherQualification",
  "guardianName","guardianMobile",
  "familyIncomeAsPerCertificate","communityCertificateNo",
  "permDoorNo","permStreet","permTaluk","permDistrict","permState","permPincode",
  "commDoorNo","commStreet","commTaluk","commDistrict","commState","commPincode",
  "quota",
  "firstGraduateApplicable",
  "firstGraduateLab","firstGraduateBook","firstGraduateErp","firstGraduateExam",
  "firstGraduateTransport","firstGraduateHostel","firstGraduateTuition",
  "scheme7point5Applicable",
  "scheme7point5Lab","scheme7point5Book","scheme7point5Erp","scheme7point5Exam",
  "scheme7point5Transport","scheme7point5Hostel","scheme7point5Tuition",
  "pmssApplicable",
  "pmssLab","pmssBook","pmssErp","pmssExam",
  "pmssTransport","pmssHostel","pmssTuition",
  "sakthiApplicable",
  "sakthiLab","sakthiBook","sakthiErp","sakthiExam",
  "sakthiTransport","sakthiHostel","sakthiTuition",
  "specialApplicable",
  "specialLab","specialBook","specialErp","specialExam",
  "specialTransport","specialHostel","specialTuition",
  "transportApplicable","transportRoute","transportStop",
  "hostelApplicable","hostelBlock","hostelSharing","hostelAttached",
];

const buildFlatRow = (rollNo, overrides = {}) => ({
  rollNo,
  studentName: `Bulk ${rollNo}`,
  gender: "Male",
  dob: "15-06-2005",
  bloodGroup: "A+",
  aadharNo: "123456789012",
  emisNo: `EMIS${rollNo}`,
  religion: "Hindu",
  community: "BC",
  casteName: "TestCaste",
  nationality: "Indian",
  studentPhoto: "photo.jpg",
  educationType: "UG",
  academicType: "REG",
  isLateralEntry: "FALSE",
  departmentName: "CSE",
  degreeProgram: "BE",
  yearStudying: 1,
  currentSemesterNumber: 1,
  section: "A",
  batch: testCtx.academicYearPrimary,
  currentAcademicYear: testCtx.academicYearPrimary,
  selfMobileNo: "9876543210",
  selfEmail: `${rollNo.toLowerCase()}@gmail.com`,
  officialEmail: `${rollNo.toLowerCase()}@sece.ac.in`,
  fatherName: "Father",
  fatherMobile: "9876500001",
  fatherWorkType: "Farmer",
  fatherQualification: "10th",
  motherName: "Mother",
  motherMobile: "9876500002",
  motherWorkType: "Homemaker",
  motherQualification: "12th",
  guardianName: "",
  guardianMobile: "",
  familyIncomeAsPerCertificate: 150000,
  communityCertificateNo: `CC${rollNo}`,
  permDoorNo: "12",
  permStreet: "Main St",
  permTaluk: "Erode",
  permDistrict: "Erode",
  permState: "Tamil Nadu",
  permPincode: "638001",
  commDoorNo: "12",
  commStreet: "Main St",
  commTaluk: "Erode",
  commDistrict: "Erode",
  commState: "Tamil Nadu",
  commPincode: "638001",
  quota: "Government Quota",
  firstGraduateApplicable: "FALSE",
  firstGraduateLab: "",
  firstGraduateBook: "",
  firstGraduateErp: "",
  firstGraduateExam: "",
  firstGraduateTransport: "",
  firstGraduateHostel: "",
  firstGraduateTuition: "",
  scheme7point5Applicable: "FALSE",
  scheme7point5Lab: "",
  scheme7point5Book: "",
  scheme7point5Erp: "",
  scheme7point5Exam: "",
  scheme7point5Transport: "",
  scheme7point5Hostel: "",
  scheme7point5Tuition: "",
  pmssApplicable: "FALSE",
  pmssLab: "",
  pmssBook: "",
  pmssErp: "",
  pmssExam: "",
  pmssTransport: "",
  pmssHostel: "",
  pmssTuition: "",
  sakthiApplicable: "FALSE",
  sakthiLab: "",
  sakthiBook: "",
  sakthiErp: "",
  sakthiExam: "",
  sakthiTransport: "",
  sakthiHostel: "",
  sakthiTuition: "",
  specialApplicable: "FALSE",
  specialLab: "",
  specialBook: "",
  specialErp: "",
  specialExam: "",
  specialTransport: "",
  specialHostel: "",
  specialTuition: "",
  transportApplicable: "FALSE",
  transportRoute: "",
  transportStop: "",
  hostelApplicable: "FALSE",
  hostelBlock: "",
  hostelSharing: "",
  hostelAttached: "",
  ...overrides,
});

const toCSVBuffer = (rows) => {
  const lines = [CSV_HEADERS.join(",")];
  rows.forEach((row) => {
    const cells = CSV_HEADERS.map((h) => {
      const val = row[h] ?? "";
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    });
    lines.push(cells.join(","));
  });
  return Buffer.from(lines.join("\n"), "utf-8");
};

const toXLSXBuffer = (rows) => {
  const aoa = [CSV_HEADERS];
  rows.forEach((row) => aoa.push(CSV_HEADERS.map((h) => row[h] ?? "")));
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Students");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
};

/* ======================================================
   LIFECYCLE
====================================================== */
const globalSetup = async () => {
  await startServer();

  const superadminLogin = await login("superadmin@sece.ac.in", "superadmin@123");
  expect(superadminLogin.status).toBe(200);
  testCtx.superadminToken = superadminLogin.body.data.token;

  const adminLogin = await login("admin@sece.ac.in", "admin@123");
  expect(adminLogin.status).toBe(200);
  testCtx.adminToken = adminLogin.body.data.token;
};

const globalTeardown = async () => {
  const allRolls = [
    testCtx.studentRollCrud, testCtx.studentRollFinance,
    testCtx.studentRollHostel, testCtx.studentRollTransport,
    testCtx.studentRollDual,
    testCtx.bulkRollA, testCtx.bulkRollB, testCtx.bulkRollC,
  ];
  await StudentTransaction.deleteMany({ rollNo: { $in: allRolls } });
  await StudentFeeTracking.deleteMany({ rollNo: { $in: allRolls } });
  await Student.deleteMany({ "personal.rollNo": { $in: allRolls } });
  await FeeStructureMaster.deleteMany({
    academicYear: { $in: [testCtx.academicYearPrimary, testCtx.academicYearSecondary] },
  });
  // Cleanup test transport/hostel if created
  if (testCtx.testTransportId) await Transport.findOneAndDelete({ id: testCtx.testTransportId });
  if (testCtx.testHostelId) await Hostel.findOneAndDelete({ id: testCtx.testHostelId });

  await stopServer();
};

module.exports = {
  request,
  app,
  testCtx,
  TS,
  buildSemesterFee,
  buildFeeStructurePayload,
  buildStudentPayload,
  buildFlatRow,
  toCSVBuffer,
  toXLSXBuffer,
  CSV_HEADERS,
  login,
  authHeader,
  superadminAuth,
  adminAuth,
  globalSetup,
  globalTeardown,
  // Models for direct DB assertions
  Student,
  FeeStructureMaster,
  StudentTransaction,
  StudentFeeTracking,
  ReceiptRecallRequest,
  ActivityLog,
  Transport,
  Hostel,
};
