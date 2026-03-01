require("dotenv").config();

const request = require("supertest");
const Student = require("../api/students/model.student");
const FeeStructureMaster = require("../api/feeStructure/model.feeStructureMaster");
const StudentTransaction = require("../api/transaction/model.studentTransaction");
const StudentFeeTracking = require("../api/studentFeeTracking/model.studentFeeTracking");
const ActivityLog = require("../models/ActivityLog");
const { app, startServer, stopServer } = require("../server");

jest.setTimeout(120000);

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
  bulkRollA: `17CS${TS.slice(-3)}`,
  bulkRollB: `18CS${TS.slice(-3)}`,
  bulkRollC: `19CS${TS.slice(-3)}`,
  receiptOne: `REC${TS.slice(-6)}A`,
  receiptTwo: `REC${TS.slice(-6)}B`,
};

const buildSemesterFee = (semesterNumber, baseTuition) => {
  const examFee = 2000;
  const erpFee = 500;
  const bookFee = 1000;
  const labFee = 1500;
  const totalFee = baseTuition + examFee + erpFee + bookFee + labFee;

  return {
    semesterNumber,
    tuition: { fee: baseTuition },
    exam: { fee: examFee },
    erp: { fee: erpFee },
    book: { fee: bookFee },
    lab: { fee: labFee },
    total: { fee: totalFee },
    isActive: true,
  };
};

const buildFeeStructurePayload = (year, { isActive = true } = {}) => {
  const semesters = Array.from({ length: 8 }, (_, idx) => buildSemesterFee(idx + 1, 40000 + idx * 1000));
  const academicDepartmentTotal = semesters.reduce((sum, sem) => sum + (sem.total?.fee || 0), 0);

  const hostelRoomFee = 30000;
  const hostelMessFee = 18000;
  const hostelMaintenanceFee = 5000;
  const hostelTotalFee = hostelRoomFee + hostelMessFee + hostelMaintenanceFee;

  return {
    academicYear: year,
    academicStructures: [
      {
        quota: "Government Quota",
        educationType: "UG",
        degreeProgram: "BE",
        departments: [
          {
            departmentName: "CSE",
            semesters,
            total: { fee: academicDepartmentTotal },
            isActive: true,
          },
        ],
        total: { fee: academicDepartmentTotal },
        isActive: true,
      },
    ],
    hostelStructures: [
      {
        block: "A-BLOCK",
        roomType: {
          sharingType: "Three",
          isAttached: true,
        },
        roomFee: { fee: hostelRoomFee },
        messFee: { fee: hostelMessFee },
        maintenanceFee: { fee: hostelMaintenanceFee },
        total: { fee: hostelTotalFee },
        isActive: true,
      },
    ],
    total: { fee: academicDepartmentTotal + hostelTotalFee },
    isActive,
  };
};

const buildStudentPayload = (rollNo, { academicYear } = {}) => ({
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
    selfEmail: `student${TS.slice(-6)}@mail.com`,
    officialEmail: `student${TS.slice(-6)}@sece.ac.in`,
  },
  family: {
    father: { name: "Father", mobile: "9876500001", workType: "Farmer", qualification: "Diploma" },
    mother: { name: "Mother", mobile: "9876500002", workType: "Homemaker", qualification: "HSC" },
    guardian: { name: "Guardian", mobile: "9876500003" },
    familyIncomeAsPerCertificate: 180000,
    communityCertificateNo: `CC${TS.slice(-8)}`,
  },
  address: {
    permanent: {
      doorNo: "12/4", street: "Main Road", taluk: "Pollachi", district: "Coimbatore", state: "Tamil Nadu", pincode: "641001",
    },
    communication: {
      doorNo: "12/4", street: "Main Road", taluk: "Pollachi", district: "Coimbatore", state: "Tamil Nadu", pincode: "641001",
    },
  },
  enrollment: {
    quota: "Government Quota",
    firstGraduate: { isApplicable: false, concessionAmount: 0 },
    scheme7point5: { isApplicable: false, concessionAmount: 0 },
    pmssScheme: { isApplicable: false, concessionAmount: 0 },
    sakthiScheme: { isApplicable: false, concessionAmount: 0 },
    specialConcession: { isApplicable: false, transport: 0, hostel: 0, tuition: 0 },
  },
  transport: { isApplicable: false },
  hostel: { isApplicable: false },
});

const login = async (email, password) => request(app).post("/api/auth/login").send({ email, password });

describe("QPulse API integration (full coverage)", () => {
  beforeAll(async () => {
    await startServer();

    const superadminLogin = await login("superadmin@sece.ac.in", "superadmin@123");
    expect(superadminLogin.status).toBe(200);
    testCtx.superadminToken = superadminLogin.body.token;

    const adminLogin = await login("admin@sece.ac.in", "admin@123");
    expect(adminLogin.status).toBe(200);
    testCtx.adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    const allRolls = [testCtx.studentRollCrud, testCtx.studentRollFinance, testCtx.studentRollHostel, testCtx.bulkRollA, testCtx.bulkRollB, testCtx.bulkRollC];
    await StudentTransaction.deleteMany({ rollNo: { $in: allRolls } });
    await StudentFeeTracking.deleteMany({ rollNo: { $in: allRolls } });
    await Student.deleteMany({ "personal.rollNo": { $in: allRolls } });
    await FeeStructureMaster.deleteMany({
      academicYear: { $in: [testCtx.academicYearPrimary, testCtx.academicYearSecondary] },
    });

    await stopServer();
  });

  describe("Auth API", () => {
    it("logs in superadmin and sets token cookie", async () => {
      const response = await login("superadmin@sece.ac.in", "superadmin@123");
      expect(response.status).toBe(200);
      expect(response.body.role).toBe("superadmin");
      expect(response.body.token).toBeDefined();
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("logs in admin successfully", async () => {
      const response = await login("admin@sece.ac.in", "admin@123");
      expect(response.status).toBe(200);
      expect(response.body.role).toBe("admin");
    });

    it("rejects login for wrong password", async () => {
      const response = await login("admin@sece.ac.in", "wrong-password");
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid password");
    });

    it("rejects login for unknown user", async () => {
      const response = await login(`unknown${TS}@sece.ac.in`, "some-password");
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("rejects login when email is missing", async () => {
      const response = await request(app).post("/api/auth/login").send({ password: "admin@123" });
      expect(response.status).toBe(400);
    });

    it("rejects login when password is missing", async () => {
      const response = await request(app).post("/api/auth/login").send({ email: "admin@sece.ac.in" });
      expect(response.status).toBe(400);
    });

    it("rejects logout without token", async () => {
      const response = await request(app).post("/api/auth/logout");
      expect(response.status).toBe(401);
    });

    it("rejects logout with malformed token", async () => {
      const response = await request(app).post("/api/auth/logout").set("Authorization", "Bearer bad.token");
      expect(response.status).toBe(401);
    });

    it("logs out successfully with valid token", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logged out successfully");
    });
  });

  describe("Authorization guards", () => {
    it("blocks fee structure create for admin", async () => {
      const response = await request(app)
        .post("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

      expect(response.status).toBe(401);
    });

    it("blocks student create for admin", async () => {
      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send(buildStudentPayload(testCtx.studentRollCrud, { academicYear: testCtx.academicYearPrimary }));

      expect(response.status).toBe(401);
    });

    it("blocks protected route without token", async () => {
      const response = await request(app).get("/api/feeStructureMaster");
      expect(response.status).toBe(401);
    });
  });

  describe("Fee Structure API", () => {
    it("creates primary fee structure", async () => {
      const response = await request(app)
        .post("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

      expect(response.status).toBe(201);
      expect(response.body.data.academicYear).toBe(testCtx.academicYearPrimary);
    });

    it("creates secondary fee structure", async () => {
      const response = await request(app)
        .post("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearSecondary));

      expect(response.status).toBe(201);
    });

    it("rejects duplicate year creation", async () => {
      const response = await request(app)
        .post("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

      expect(response.status).toBe(400);
    });

    it("rejects invalid academicYear format", async () => {
      const response = await request(app)
        .post("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload("bad-year"));

      expect(response.status).toBe(400);
    });

    it("lists fee structures", async () => {
      const response = await request(app)
        .get("/api/feeStructureMaster")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("gets fee structure by year", async () => {
      const response = await request(app)
        .get(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.academicYear).toBe(testCtx.academicYearPrimary);
    });

    it("returns 404 for unknown year", async () => {
      const response = await request(app)
        .get(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(404);
    });

    it("updates fee structure", async () => {
      const response = await request(app)
        .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearPrimary, { isActive: false }));

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });

    it("reactivates fee structure for student ledger generation", async () => {
      const response = await request(app)
        .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearPrimary, { isActive: true }));

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });

    it("rejects invalid update payload", async () => {
      const response = await request(app)
        .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload("bad-year"));

      expect(response.status).toBe(400);
    });

    it("returns 400 updating unknown year", async () => {
      const response = await request(app)
        .put(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildFeeStructurePayload(testCtx.academicYearMissing));

      expect(response.status).toBe(400);
    });

    it("returns 404 deleting unknown year", async () => {
      const response = await request(app)
        .delete(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Students API", () => {
    it("rejects invalid rollNo on create", async () => {
      const payload = buildStudentPayload("BADROLL", { academicYear: testCtx.academicYearPrimary });
      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(payload);

      expect(response.status).toBe(400);
    });

    it("rejects invalid gender on create", async () => {
      const payload = buildStudentPayload(`14CS${TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
      payload.personal.gender = "Unknown";

      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(payload);

      expect(response.status).toBe(400);
    });

    it("rejects invalid hostel sharingType on create", async () => {
      const payload = buildStudentPayload(`15CS${TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
      payload.hostel = {
        isApplicable: false,
        roomType: { sharingType: "Three", isAttached: true },
      };

      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(payload);

      expect(response.status).toBe(400);
    });

    it("creates CRUD student and tracking", async () => {
      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildStudentPayload(testCtx.studentRollCrud, { academicYear: testCtx.academicYearPrimary }));

      expect(response.status).toBe(201);
      const trackingDoc = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollCrud });
      expect(trackingDoc).toBeTruthy();
    });

    it("creates finance student", async () => {
      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildStudentPayload(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary }));

      expect(response.status).toBe(201);
    });

    it("creates student with hostel", async () => {
      const payload = buildStudentPayload(testCtx.studentRollHostel, { academicYear: testCtx.academicYearPrimary });
      payload.hostel = {
        isApplicable: true,
        block: "A",
        sharing: 3,
        isAttached: true,
        roomType: { sharingType: 3, isAttached: true }
      };

      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(payload);

      expect(response.status).toBe(201);

      const trackingDoc = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
      expect(trackingDoc).toBeTruthy();

      const yearRecord = trackingDoc.academicYearWiseRecord.find((item) => item.academicYear === testCtx.academicYearPrimary);
      expect(yearRecord.hostel).toBeDefined();
    });

    it("rejects duplicate create", async () => {
      const response = await request(app)
        .post("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send(buildStudentPayload(testCtx.studentRollCrud, { academicYear: testCtx.academicYearPrimary }));

      expect(response.status).toBe(409);
    });

    it("lists students", async () => {
      const response = await request(app)
        .get("/api/studentsManagement")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("gets student by rollNo", async () => {
      const response = await request(app)
        .get(`/api/studentsManagement/${testCtx.studentRollCrud}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.personal.rollNo).toBe(testCtx.studentRollCrud);
    });

    it("returns 404 for unknown student", async () => {
      const response = await request(app)
        .get("/api/studentsManagement/99CS999")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(404);
    });

    it("updates student fields", async () => {
      const response = await request(app)
        .put(`/api/studentsManagement/${testCtx.studentRollCrud}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send({
          personal: { studentName: "Updated Student" },
          contact: { selfMobileNo: "9876543211" },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.personal.studentName).toBe("Updated Student");
    });

    it("rejects invalid update payload", async () => {
      const response = await request(app)
        .put(`/api/studentsManagement/${testCtx.studentRollCrud}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send({ contact: { selfMobileNo: "123" } });

      expect(response.status).toBe(400);
    });

    it("returns 404 updating unknown student", async () => {
      const response = await request(app)
        .put("/api/studentsManagement/98CS998")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .send({ personal: { studentName: "No One" } });

      expect(response.status).toBe(404);
    });

    it("returns 404 deleting unknown student", async () => {
      const response = await request(app)
        .delete("/api/studentsManagement/97CS997")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(404);
    });

    it("deletes CRUD student and tracking", async () => {
      const response = await request(app)
        .delete(`/api/studentsManagement/${testCtx.studentRollCrud}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);

      const studentDoc = await Student.findOne({ "personal.rollNo": testCtx.studentRollCrud });
      const trackingDoc = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollCrud });
      expect(studentDoc).toBeNull();
      expect(trackingDoc).toBeNull();
    });
  });

  /* =====================================================
     BULK IMPORT / UPDATE  (CSV & XLSX)
  ===================================================== */
  describe("Students Bulk Import / Update API", () => {
    const xlsx = require("xlsx");
    const path = require("path");

    /**
     * Helper: build a CSV buffer from an array of flat row objects.
     * Column order follows the data.csv header convention.
     */
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
      "firstGraduateApplicable","firstGraduateConcession",
      "scheme7point5Applicable","scheme7point5Concession",
      "pmssApplicable","pmssConcession",
      "sakthiApplicable","sakthiConcession",
      "specialApplicable","specialTransport","specialHostel","specialTuition",
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
      firstGraduateConcession: 0,
      scheme7point5Applicable: "FALSE",
      scheme7point5Concession: 0,
      pmssApplicable: "FALSE",
      pmssConcession: 0,
      sakthiApplicable: "FALSE",
      sakthiConcession: 0,
      specialApplicable: "FALSE",
      specialTransport: 0,
      specialHostel: 0,
      specialTuition: 0,
      transportApplicable: "FALSE",
      transportRoute: "",
      transportStop: "",
      hostelApplicable: "FALSE",
      hostelBlock: "",
      hostelSharing: "",
      hostelAttached: "",
      ...overrides,
    });

    /** Convert flat row objects into a CSV Buffer */
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

    /** Convert flat row objects into an XLSX Buffer */
    const toXLSXBuffer = (rows) => {
      const aoa = [CSV_HEADERS];
      rows.forEach((row) => aoa.push(CSV_HEADERS.map((h) => row[h] ?? "")));
      const ws = xlsx.utils.aoa_to_sheet(aoa);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Students");
      return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    };

    /* ----------  BULK CREATE  ---------- */

    it("rejects bulk create without file", async () => {
      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no file/i);
    });

    it("rejects empty CSV file", async () => {
      const emptyCSV = Buffer.from(CSV_HEADERS.join(",") + "\n");
      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", emptyCSV, "empty.csv");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/empty|no data/i);
    });

    it("rejects bulk create for admin role", async () => {
      const csvBuf = toCSVBuffer([buildFlatRow(testCtx.bulkRollA)]);
      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .attach("file", csvBuf, "students.csv");

      expect(res.status).toBe(401);
    });

    it("bulk creates students from CSV (2 valid rows)", async () => {
      const csvBuf = toCSVBuffer([
        buildFlatRow(testCtx.bulkRollA),
        buildFlatRow(testCtx.bulkRollB),
      ]);

      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", csvBuf, "students.csv");

      expect(res.status).toBe(201);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.summary.created).toBe(2);
      expect(res.body.summary.failed).toBe(0);
      expect(res.body.created).toHaveLength(2);

      // Verify students exist in DB
      const studentA = await Student.findOne({ "personal.rollNo": testCtx.bulkRollA });
      const studentB = await Student.findOne({ "personal.rollNo": testCtx.bulkRollB });
      expect(studentA).toBeTruthy();
      expect(studentB).toBeTruthy();

      // Verify fee tracking was generated
      const trackingA = await StudentFeeTracking.findOne({ rollNo: testCtx.bulkRollA });
      expect(trackingA).toBeTruthy();
    });

    it("bulk create from XLSX with 1 valid + 1 duplicate → 207 multi-status", async () => {
      const xlsxBuf = toXLSXBuffer([
        buildFlatRow(testCtx.bulkRollC),        // new  → should succeed
        buildFlatRow(testCtx.bulkRollA),         // already exists → should fail
      ]);

      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", xlsxBuf, "students.xlsx");

      expect(res.status).toBe(207);
      expect(res.body.summary.created).toBe(1);
      expect(res.body.summary.failed).toBe(1);
      expect(res.body.failed[0].rollNo).toBe(testCtx.bulkRollA);
      expect(res.body.failed[0].reason).toMatch(/already exists/i);
    });

    it("handles CSV with null / missing columns gracefully", async () => {
      // Build a CSV with only a few columns (many fields will be null)
      const minimalHeaders = ["rollNo", "degreeProgram", "batch", "currentAcademicYear"];
      const line = [`20CS${TS.slice(-3)}`, "BE", testCtx.academicYearPrimary, testCtx.academicYearPrimary].join(",");
      const csvBuf = Buffer.from(minimalHeaders.join(",") + "\n" + line, "utf-8");

      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", csvBuf, "minimal.csv");

      // Should attempt creation — may succeed or fail depending on model validations,
      // but must NOT crash (500). Expect 201 or 207.
      expect([201, 207]).toContain(res.status);
      expect(res.body.summary).toBeDefined();

      // Cleanup this one-off student if it was created
      await StudentFeeTracking.deleteMany({ rollNo: `20CS${TS.slice(-3)}` });
      await Student.deleteMany({ "personal.rollNo": `20CS${TS.slice(-3)}` });
    });

    it("handles CSV with misaligned / extra columns", async () => {
      const header = "extraCol,rollNo,unknownField,degreeProgram,batch,currentAcademicYear,anotherExtra";
      const row = `foo,21CS${TS.slice(-3)},bar,BE,${testCtx.academicYearPrimary},${testCtx.academicYearPrimary},baz`;
      const csvBuf = Buffer.from(header + "\n" + row, "utf-8");

      const res = await request(app)
        .post("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", csvBuf, "misaligned.csv");

      expect([201, 207]).toContain(res.status);
      expect(res.body.summary).toBeDefined();

      // Cleanup
      await StudentFeeTracking.deleteMany({ rollNo: `21CS${TS.slice(-3)}` });
      await Student.deleteMany({ "personal.rollNo": `21CS${TS.slice(-3)}` });
    });

    /* ----------  BULK UPDATE  ---------- */

    it("rejects bulk update without file", async () => {
      const res = await request(app)
        .put("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no file/i);
    });

    it("rejects bulk update for admin role", async () => {
      const csvBuf = toCSVBuffer([buildFlatRow(testCtx.bulkRollA, { studentName: "Updated" })]);
      const res = await request(app)
        .put("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .attach("file", csvBuf, "update.csv");

      expect(res.status).toBe(401);
    });

    it("bulk updates students from CSV", async () => {
      const csvBuf = toCSVBuffer([
        buildFlatRow(testCtx.bulkRollA, { studentName: "Updated A" }),
        buildFlatRow(testCtx.bulkRollB, { studentName: "Updated B" }),
      ]);

      const res = await request(app)
        .put("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", csvBuf, "update.csv");

      expect(res.status).toBe(200);
      expect(res.body.summary.updated).toBe(2);
      expect(res.body.summary.failed).toBe(0);

      // Verify the names were actually updated
      const a = await Student.findOne({ "personal.rollNo": testCtx.bulkRollA });
      const b = await Student.findOne({ "personal.rollNo": testCtx.bulkRollB });
      expect(a.personal.studentName).toBe("Updated A");
      expect(b.personal.studentName).toBe("Updated B");
    });

    it("bulk update from XLSX with valid + not-found → 207", async () => {
      const xlsxBuf = toXLSXBuffer([
        buildFlatRow(testCtx.bulkRollC, { studentName: "Updated C" }),
        buildFlatRow("99CS999", { studentName: "Ghost" }),       // does not exist
      ]);

      const res = await request(app)
        .put("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", xlsxBuf, "update.xlsx");

      expect(res.status).toBe(207);
      expect(res.body.summary.updated).toBe(1);
      expect(res.body.summary.failed).toBe(1);
      expect(res.body.failed[0].rollNo).toBe("99CS999");
      expect(res.body.failed[0].reason).toMatch(/not found/i);
    });

    it("bulk update handles rows missing rollNo", async () => {
      // CSV with rollNo column but empty value → should report error, not crash
      const rows = [
        buildFlatRow("", { studentName: "No Roll" }),
      ];
      const csvBuf = toCSVBuffer(rows);

      const res = await request(app)
        .put("/api/studentsManagement/bulk")
        .set("Authorization", `Bearer ${testCtx.superadminToken}`)
        .attach("file", csvBuf, "noroll.csv");

      expect(res.status).toBe(207);
      expect(res.body.summary.failed).toBe(1);
      expect(res.body.failed[0].reason).toMatch(/rollNo.*required/i);
    });

    /* ----------  BULK CLEANUP  ---------- */

    it("deletes bulk-created students", async () => {
      for (const rollNo of [testCtx.bulkRollA, testCtx.bulkRollB, testCtx.bulkRollC]) {
        const res = await request(app)
          .delete(`/api/studentsManagement/${rollNo}`)
          .set("Authorization", `Bearer ${testCtx.superadminToken}`);
        expect(res.status).toBe(200);
      }
    });
  });

  describe("Fee Payment / Transaction API", () => {
    it("rejects payment without auth token", async () => {
      const response = await request(app).post("/api/feePayment/pay").send({});
      expect(response.status).toBe(401);
    });

    it("rejects payment with missing fields", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("rejects payment with invalid paymentType", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: `${testCtx.receiptOne}-X`,
          paymentType: "Crypto",
          breakdowns: [{ academicYear: testCtx.academicYearPrimary }],
        });

      expect(response.status).toBe(400);
    });

    it("rejects payment with empty breakdowns", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: `${testCtx.receiptOne}-Y`,
          paymentType: "Cash",
          breakdowns: [],
        });

      expect(response.status).toBe(400);
    });

    it("rejects payment with invalid semester", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: `${testCtx.receiptOne}-Z`,
          paymentType: "Cash",
          breakdowns: [{ academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 9, tuition: 1000 } }],
        });

      expect(response.status).toBe(400);
    });

    it("rejects payment with invalid academicYear", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: `${testCtx.receiptOne}-W`,
          paymentType: "Cash",
          breakdowns: [{ academicYear: "2026/2027", academic: { semesterNumber: 1 } }],
        });

      expect(response.status).toBe(400);
    });

    it("rejects payment for unknown rollNo", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: "90CS900",
          receiptNo: `${testCtx.receiptOne}-U`,
          paymentType: "Cash",
          breakdowns: [{ academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 1, tuition: 100 } }],
        });

      expect(response.status).toBe(400);
    });

    it("records first payment", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: testCtx.receiptOne,
          paymentType: "Cash",
          bankName: "Indian Bank",
          bankLocation: "Kinathukadavu",
          remarks: "first payment",
          breakdowns: [
            {
              academicYear: testCtx.academicYearPrimary,
              academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
              hostel: 0,
              transport: 0,
            },
          ],
        });

      expect(response.status).toBe(201);
    });

    it("records second payment with decimals", async () => {
      const response = await request(app)
        .post("/api/feePayment/pay")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({
          rollNo: testCtx.studentRollFinance,
          receiptNo: testCtx.receiptTwo,
          paymentType: "UPI",
          remarks: "second payment",
          breakdowns: [
            {
              academicYear: testCtx.academicYearPrimary,
              academic: { semesterNumber: 1, tuition: 250.5, exam: 100.25, erp: 0, book: 0, lab: 0 },
              hostel: 0,
              transport: 0,
            },
          ],
        });

      expect(response.status).toBe(201);
    });

    it("gets student transactions", async () => {
      const response = await request(app)
        .get(`/api/feePayment/${testCtx.studentRollFinance}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(2);
    });

    it("returns 404 for missing transactions", async () => {
      const response = await request(app)
        .get("/api/feePayment/95CS995")
        .set("Authorization", `Bearer ${testCtx.adminToken}`);

      expect(response.status).toBe(404);
    });

    it("gets recent payments without filters", async () => {
      const response = await request(app)
        .get("/api/feePayment/recent")
        .set("Authorization", `Bearer ${testCtx.adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("gets recent payments with filters", async () => {
      const response = await request(app)
        .get("/api/feePayment/recent")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .query({
          year: testCtx.academicYearPrimary,
          department: "CSE",
          paymentMode: "UPI",
          limit: 1,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it("updates fee tracking paid total after payment", async () => {
      const trackingDoc = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
      const yearRecord = trackingDoc.academicYearWiseRecord.find((item) => item.academicYear === testCtx.academicYearPrimary);
      expect(yearRecord.total.paid).toBeGreaterThan(0);
    });
  });

  describe("Fee Tracking API", () => {
    it("rejects summary access without token", async () => {
      const response = await request(app).get("/api/studentFeeTracking/summary");
      expect(response.status).toBe(401);
    });

    it("gets year summary", async () => {
      const response = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .query({ year: testCtx.academicYearPrimary });

      expect(response.status).toBe(200);
      expect(response.body.data.aggregate).toBeDefined();
    });

    it("gets student fee summary", async () => {
      const response = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.studentProfile.personal.rollNo).toBe(testCtx.studentRollFinance);
    });

    it("returns 404 for unknown fee summary student", async () => {
      const response = await request(app)
        .get("/api/studentFeeTracking/summary/94CS994")
        .set("Authorization", `Bearer ${testCtx.adminToken}`);

      expect(response.status).toBe(404);
    });

    it("filters students by department and year", async () => {
      const response = await request(app)
        .get("/api/studentFeeTracking/students")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .query({ department: "CSE", year: 1 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("filters students by name", async () => {
      const response = await request(app)
        .get("/api/studentFeeTracking/students")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .query({ name: "Jest" });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("rejects receipt update with no fields", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("rejects receipt update with invalid paymentType", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ paymentType: "WIRE" });

      expect(response.status).toBe(400);
    });

    it("returns 400 for unknown receipt update", async () => {
      const response = await request(app)
        .put("/api/studentFeeTracking/receipt/UNKNOWN-REC")
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ remarks: "x" });

      expect(response.status).toBe(400);
    });

    it("updates receipt successfully", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ paymentType: "Card", bankName: "SBI", remarks: "updated" });

      expect(response.status).toBe(200);
      expect(response.body.data.paymentType).toBe("Card");

      const log = await ActivityLog.findOne({ endpoint: `/api/studentFeeTracking/receipt/${testCtx.receiptOne}` });
      expect(log).toBeTruthy();
    });

    it("rejects concession update when concessions missing", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("rejects concession update with invalid precision", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ concessions: { firstGraduate: 100.257 } });

      expect(response.status).toBe(400);
    });

    it("returns 400 for unknown student concession update", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/concession/93CS993/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ concessions: { firstGraduate: 100 } });

      expect(response.status).toBe(400);
    });

    it("returns 400 for unknown academic year concession", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearMissing}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ concessions: { firstGraduate: 100 } });

      expect(response.status).toBe(400);
    });

    it("updates concession successfully", async () => {
      const response = await request(app)
        .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.adminToken}`)
        .send({ concessions: { firstGraduate: 1000, scheme7point5: 500, pmss: 250, sakthi: 250 } });

      expect(response.status).toBe(200);
      expect(response.body.data.totalConcession).toBe(2000);
    });
  });

  describe("Transport API", () => {
    it("returns full mapping", async () => {
      const response = await request(app).get("/api/transport");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns stops without filters", async () => {
      const response = await request(app).post("/api/transport/stops").send({});
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns stops by route", async () => {
      const response = await request(app).post("/api/transport/stops").send({ route: "Bharathiyar University" });
      expect(response.status).toBe(200);
    });

    it("rejects stops route non-string", async () => {
      const response = await request(app).post("/api/transport/stops").send({ route: 123 });
      expect(response.status).toBe(400);
    });

    it("rejects buses when stop missing", async () => {
      const response = await request(app).post("/api/transport/buses").send({});
      expect(response.status).toBe(400);
    });

    it("rejects buses for blank stop", async () => {
      const response = await request(app).post("/api/transport/buses").send({ stop: "   " });
      expect(response.status).toBe(400);
    });

    it("returns buses for valid stop", async () => {
      const response = await request(app).post("/api/transport/buses").send({ stop: "Kinathukadavu" });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("rejects fees without filters", async () => {
      const response = await request(app).post("/api/transport/fees").send({});
      expect(response.status).toBe(400);
    });

    it("rejects fees with non-string busNo", async () => {
      const response = await request(app).post("/api/transport/fees").send({ busNo: 9 });
      expect(response.status).toBe(400);
    });

    it("returns fees by busNo", async () => {
      const response = await request(app).post("/api/transport/fees").send({ busNo: "1" });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns fees by stop", async () => {
      const response = await request(app).post("/api/transport/fees").send({ stop: "Kinathukadavu" });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns fees by busNo and stop", async () => {
      const response = await request(app).post("/api/transport/fees").send({ busNo: "1", stop: "Kinathukadavu" });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe("Generic and cleanup", () => {
    it("returns 404 for unknown endpoint", async () => {
      const response = await request(app).get("/api/non-existent-endpoint");
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Route not found");
    });

    it("deletes secondary fee structure", async () => {
      const response = await request(app)
        .delete(`/api/feeStructureMaster/${testCtx.academicYearSecondary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
    });

    it("deletes primary fee structure", async () => {
      const response = await request(app)
        .delete(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
    });

    it("deletes finance student", async () => {
      const response = await request(app)
        .delete(`/api/studentsManagement/${testCtx.studentRollFinance}`)
        .set("Authorization", `Bearer ${testCtx.superadminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
