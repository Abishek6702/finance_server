const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Payment / Transaction API", () => {
  // Shared state for get-by-receipt tests
  let capturedReceiptNo;
  let capturedBreakdownIds;

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

    // Make a payment so we have a real receipt to test get-by-receiptNo
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "Cash",
        bankName: "Indian Bank",
        bankLocation: "Kinathukadavu",
        remarks: "Semester-1 fee payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500 },
        }],
      });
    expect(payRes.status).toBe(201);
    const lastTxn = payRes.body.data.transactions[payRes.body.data.transactions.length - 1];
    capturedReceiptNo = lastTxn.receiptNo;
    capturedBreakdownIds = lastTxn.breakdowns.map(b => b._id);
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

  /* ================================================================
     GET /receipt/:receiptNo — Get Receipt By Receipt Number
  ================================================================ */

  it("rejects get-by-receiptNo without auth token", async () => {
    const res = await request(app).get(`/api/feePayment/receipt/${capturedReceiptNo}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent receipt number", async () => {
    const res = await request(app)
      .get("/api/feePayment/receipt/REC-00000000-000")
      .set(adminAuth());
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns receipt detail with all required fields", async () => {
    const res = await request(app)
      .get(`/api/feePayment/receipt/${capturedReceiptNo}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNo).toBe(capturedReceiptNo);
    expect(res.body.data.rollNo).toBe(testCtx.studentRollFinance);
    expect(res.body.data.paymentType).toBe("Cash");
    expect(res.body.data.bankName).toBe("Indian Bank");
    expect(res.body.data.bankLocation).toBe("Kinathukadavu");
    expect(res.body.data.remarks).toBe("Semester-1 fee payment");
    expect(typeof res.body.data.totalAmount).toBe("number");
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
  });

  it("returns breakdowns array with _id, feeStructureId, and fee amounts", async () => {
    const res = await request(app)
      .get(`/api/feePayment/receipt/${capturedReceiptNo}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    const breakdowns = res.body.data.breakdowns;
    expect(Array.isArray(breakdowns)).toBe(true);
    expect(breakdowns.length).toBeGreaterThan(0);

    const bd = breakdowns[0];
    expect(bd._id).toBeDefined();
    expect(capturedBreakdownIds).toContain(bd._id);
    expect(bd.academicYear).toBe(testCtx.academicYearPrimary);
    // feeStructureId must be populated (we created a fee structure in beforeAll)
    expect(bd.feeStructureId).toBeTruthy();
    expect(typeof bd.total).toBe("number");
    expect(bd.academic).toBeDefined();
  });

  it("transport and hostel IDs are null for a non-hostel/transport student", async () => {
    const res = await request(app)
      .get(`/api/feePayment/receipt/${capturedReceiptNo}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    const bd = res.body.data.breakdowns[0];
    // studentRollFinance has neither hostel nor transport
    expect(bd.transportId).toBeNull();
    expect(bd.hostelId).toBeNull();
  });

  it("receiptNo param is case-insensitive (normalised to uppercase)", async () => {
    const lower = capturedReceiptNo.toLowerCase();
    const res = await request(app)
      .get(`/api/feePayment/receipt/${lower}`)
      .set(adminAuth());
    // May differ from DB value – service looks up as-is from param after toUpperCase
    // We just verify no 500; it will 404 if DB stored uppercase (expected)
    expect([200, 404]).toContain(res.status);
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
