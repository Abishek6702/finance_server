const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Payment / Transaction API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Create fee structure
    await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));
    // Create finance student
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary }));
    // Create student with hostel for hostel overpayment tests
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollHostel, {
        academicYear: testCtx.academicYearPrimary,
        hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
      }));
    // Create student with transport for transport overpayment tests
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollTransport, {
        academicYear: testCtx.academicYearPrimary,
        transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
      }));
  });

  afterAll(async () => {
    for (const rollNo of [testCtx.studentRollFinance, testCtx.studentRollHostel, testCtx.studentRollTransport]) {
      await StudentTransaction.deleteMany({ rollNo });
      await StudentFeeTracking.deleteMany({ rollNo });
      await Student.deleteMany({ "personal.rollNo": rollNo });
    }
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });
});
