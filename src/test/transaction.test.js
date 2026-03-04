const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Payment / Transaction API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Create fee structure
    await createFeeStructure(testCtx.academicYearPrimary);
    // Create finance student
    await createStudent(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary });
    // Create student with hostel for hostel overpayment tests
    await createStudent(testCtx.studentRollHostel, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
    });
    // Create student with transport for transport overpayment tests
    await createStudent(testCtx.studentRollTransport, {
      academicYear: testCtx.academicYearPrimary,
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
    });
  });

  afterAll(async () => {
    await Promise.all(
      [testCtx.studentRollFinance, testCtx.studentRollHostel, testCtx.studentRollTransport].map((rollNo) =>
        Promise.all([
          StudentTransaction.deleteMany({ rollNo }),
          StudentFeeTracking.deleteMany({ rollNo }),
          Student.deleteMany({ "personal.rollNo": rollNo }),
        ])
      )
    );
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  it("setup completes successfully", () => {
    expect(true).toBe(true);
  });

  it("rejects payment more than net total but less than gross total (concession enforced)", async () => {
    // Use the pre-defined overpay roll number (covered by globalTeardown)
    const rollNo = testCtx.studentRollOverpay;

    // Create student with tuition concession
    const stuRes = await createStudent(rollNo, {
        academicYear: testCtx.academicYearPrimary,
        enrollment: {
          quota: "Government Quota",
          firstGraduate: {
            isApplicable: true,
            yearlyTuitionConcessionAmount: 10000,
            yearlyExamConcessionAmount: 0,
            yearlyErpConcessionAmount: 0,
            yearlyBookConcessionAmount: 0,
            yearlyLabConcessionAmount: 0,
            yearlyTransportConcessionAmount: 0,
            yearlyHostelConcessionAmount: 0,
          },
          scheme7point5: { isApplicable: false },
          pmssScheme: { isApplicable: false },
          sakthiScheme: { isApplicable: false },
          specialConcession: { isApplicable: false },
        },
      });
    expect([200, 201]).toContain(stuRes.status);

    // Fetch tracking to get net and gross amounts
    const trackRes = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo });
    expect(trackRes.status).toBe(200);

    const yr = trackRes.body.data[0].feeTracking.academicYearWiseRecord[0];
    const grossTuition = yr.academic.odd.tuition.subTotal;
    const netTuition = yr.academic.odd.tuition.total;

    // Confirm concession is applied: net < gross
    expect(netTuition).toBeLessThan(grossTuition);

    // Pay between net and gross — should be rejected
    const midAmount = Math.floor((netTuition + grossTuition) / 2);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "Cash",
        bankName: "Test Bank",
        bankLocation: "Test",
        remarks: "overpay between net and gross",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: midAmount },
        }],
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.message).toMatch(/exceeds/i);

    // Cleanup
    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });
});
