const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Payment / Transaction API", () => {

  let seededReceiptNo;

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
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500 },
        }],
      });
    expect(payRes.status).toBe(201);
    seededReceiptNo = payRes.body.data;

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

  it("accepts excess_amount payment when student has sufficient excess", async () => {
    const rollNo = `30CS${testCtx.TS.slice(-3)}`;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      enrollment: {
        quota: "Government Quota",
        firstGraduate: { isApplicable: false },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
        excessAmount: 10000,
        isExcessAmountTrue: true,
      },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "excess_amount",
        excess_amount: 10000,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000 },
        }],
      });

    expect(payRes.status).toBe(201);

    const updatedStudent = await Student.findOne({ "personal.rollNo": rollNo }).lean();
    expect(updatedStudent.enrollment.excessAmount).toBeCloseTo(9000, 2);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  it("rejects excess_amount payment when scheme is not enabled", async () => {
    const rollNo = `31CS${testCtx.TS.slice(-3)}`;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      enrollment: {
        quota: "Government Quota",
        firstGraduate: { isApplicable: false },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
        excessAmount: 5000,
        isExcessAmountTrue: false,
      },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "excess_amount",
        excess_amount: 5000,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000 },
        }],
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.message).toMatch(/excess amount is not enabled/i);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  describe("GET /api/feePayment/recent", () => {
    it("returns array of flat rows with required fields", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.transactions)).toBe(true);

      if (res.body.data.transactions.length > 0) {
        const row = res.body.data.transactions[0];
        expect(row).toHaveProperty("studentName");
        expect(row).toHaveProperty("rollNo");
        expect(row).toHaveProperty("feeHead");
        expect(row).toHaveProperty("amount");
        expect(row).toHaveProperty("paidOn");
        expect(row).toHaveProperty("receiptNo");
        expect(row).toHaveProperty("breakdownId");
      }
    });

    it("returns pagination metadata", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ limit: 5 });

      expect(res.status).toBe(200);
      const { pagination } = res.body.data;
      expect(pagination).toHaveProperty("total");
      expect(pagination).toHaveProperty("page", 1);
      expect(pagination).toHaveProperty("limit", 5);
      expect(pagination).toHaveProperty("totalPages");
    });

    it("filters by feeHead=tuition — all rows should have feeHead tuition", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ feeHead: "tuition", limit: 20 });

      expect(res.status).toBe(200);
      const rows = res.body.data.transactions;
      rows.forEach((row) => expect(row.feeHead).toBe("tuition"));
    });

    it("filters by paymentMode=Cash — all rows should have paymentMode Cash", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ paymentMode: "Cash", limit: 20 });

      expect(res.status).toBe(200);
      res.body.data.transactions.forEach((row) =>
        expect(row.paymentMode).toBe("Cash")
      );
    });

    it("filters by today's date range and finds the payment made in beforeAll", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ fromDate: today, toDate: today, paymentMode: "Cash", limit: 50 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("rejects invalid feeHead with 400", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ feeHead: "invalid_head" });

      expect(res.status).toBe(400);
    });

    it("rejects invalid yearStudying with 400", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ yearStudying: "9" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/feePayment/bill/:receiptNo", () => {
    it("returns a formatted bill for a valid receiptNo", async () => {
      const res = await request(app)
        .get(`/api/feePayment/bill/${seededReceiptNo}`)
        .set(adminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      expect(d.receiptNo).toBe(seededReceiptNo);
      expect(d.date).toMatch(/^\d{2}-\d{2}-\d{4}$/);
      expect(d.studentName).toBeTruthy();
      expect(d.rollNo).toBe(testCtx.studentRollFinance.toUpperCase());
      expect(d.breakdowns).toBeDefined();
      expect(typeof d.breakdowns).toBe("object");
      expect(d.totalAmount).toBeGreaterThan(0);
      expect(d.amountInWords).toMatch(/Only$/);
      expect(typeof d.cashAmount).toBe("number");
      expect(typeof d.bankAmount).toBe("number");
    });

    it("cashAmount equals totalAmount when paymentType is Cash", async () => {
      const res = await request(app)
        .get(`/api/feePayment/bill/${seededReceiptNo}`)
        .set(adminAuth());

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.cashAmount).toBe(d.totalAmount);
      expect(d.bankAmount).toBe(0);
    });

    it("breakdowns keys are human-readable fee labels", async () => {
      const res = await request(app)
        .get(`/api/feePayment/bill/${seededReceiptNo}`)
        .set(adminAuth());

      expect(res.status).toBe(200);
      const keys = Object.keys(res.body.data.breakdowns);
      const validHeads = ["Tuition Fee", "Exam Fee", "ERP Fee", "Book Fee", "Lab Fee", "Hostel Fee", "Transport Fee"];
      const validPrefixes = ["Regular", "Part time"];

      keys.forEach((k) => {
        if (validHeads.includes(k)) {
          expect(validHeads).toContain(k);
          return;
        }

        const [prefix, ...headParts] = k.split(" - ");
        const head = headParts.join(" - ");

        expect(validPrefixes).toContain(prefix);
        expect(validHeads).toContain(head);
      });
    });

    it("returns 404 for a non-existent receiptNo", async () => {
      const res = await request(app)
        .get("/api/feePayment/bill/REC-99999999-999")
        .set(adminAuth());

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/receipt not found/i);
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app)
        .get(`/api/feePayment/bill/${seededReceiptNo}`);

      expect(res.status).toBe(401);
    });
  });
});
