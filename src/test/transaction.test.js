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

  /* ─── VALIDATION EDGE CASES ───── */

  it("rejects payment without auth token", async () => {
    const res = await request(app).post("/api/feePayment/pay").send({});
    expect(res.status).toBe(401);
  });

  it("rejects payment with missing fields", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects payment with invalid paymentType", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `${testCtx.receiptOne}-X`,
        paymentType: "Crypto",
        breakdowns: [{ academicYear: testCtx.academicYearPrimary }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects payment with empty breakdowns", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `${testCtx.receiptOne}-Y`,
        paymentType: "Cash",
        breakdowns: [],
      });
    expect(res.status).toBe(400);
  });

  it("rejects payment with invalid semester (9)", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `${testCtx.receiptOne}-Z`,
        paymentType: "Cash",
        breakdowns: [{ academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 9, tuition: 1000 } }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects payment with invalid academicYear format", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `${testCtx.receiptOne}-W`,
        paymentType: "Cash",
        breakdowns: [{ academicYear: "2026/2027", academic: { semesterNumber: 1 } }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects payment for unknown rollNo", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: "90CS900",
        receiptNo: `${testCtx.receiptOne}-U`,
        paymentType: "Cash",
        breakdowns: [{ academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 1, tuition: 100 } }],
      });
    expect(res.status).toBe(404);
  });

  it("rejects payment for non-existent academic year in tracking", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `${testCtx.receiptOne}-AY`,
        paymentType: "Cash",
        breakdowns: [{ academicYear: testCtx.academicYearMissing, academic: { semesterNumber: 1, tuition: 100 } }],
      });
    expect(res.status).toBe(404);
  });

  /* ─── OVERPAYMENT PREVENTION ───── */

  it("rejects tuition overpayment (pays more than total due)", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const tuitionFee = yr.academic.odd.tuition.total;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER-TUI-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: tuitionFee + 1, exam: 0, erp: 0, book: 0, lab: 0 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tuition.*exceeds/i);
  });

  it("rejects exam overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const examFee = yr.academic.odd.exam.total;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER-EXM-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 0, exam: examFee + 1, erp: 0, book: 0, lab: 0 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exam.*exceeds/i);
  });

  it("rejects erp overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const erpFee = yr.academic.odd.erp.total;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER-ERP-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 0, exam: 0, erp: erpFee + 1, book: 0, lab: 0 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/erp.*exceeds/i);
  });

  it("rejects book overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const bookFee = yr.academic.odd.book.total;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER-BK-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 0, exam: 0, erp: 0, book: bookFee + 1, lab: 0 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/book.*exceeds/i);
  });

  it("rejects lab overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const labFee = yr.academic.odd.lab.total;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER-LAB-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 0, exam: 0, erp: 0, book: 0, lab: labFee + 1 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/lab.*exceeds/i);
  });

  it("rejects hostel overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const hostelTotal = yr.hostel?.total?.total || 0;
    expect(hostelTotal).toBeGreaterThan(0);

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollHostel,
        receiptNo: `OVER-HST-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          hostel: hostelTotal + 1,
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hostel.*exceeds/i);
  });

  it("rejects transport overpayment", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollTransport });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const transportTotal = yr.transport?.total?.total || 0;

    // Only test if transport fee tracking exists
    if (transportTotal > 0) {
      const res = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo: testCtx.studentRollTransport,
          receiptNo: `OVER-TRN-${testCtx.TS.slice(-5)}`,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            transport: transportTotal + 1,
          }],
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/transport.*exceeds/i);
    }
  });

  it("rejects hostel payment when student has no hostel record", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance, // no hostel
        receiptNo: `NOHST-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          hostel: 500,
        }],
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no hostel/i);
  });

  it("rejects transport payment when student has no transport record", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance, // no transport
        receiptNo: `NOTRN-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          transport: 500,
        }],
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no transport/i);
  });

  it("rejects zero-amount payment (all fields 0)", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `ZERO-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 0, exam: 0, erp: 0, book: 0, lab: 0 },
          hostel: 0,
          transport: 0,
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/greater than 0/i);
  });

  /* ─── VALID PAYMENTS ───── */

  it("records first payment (Cash, semester 1)", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptOne,
        paymentType: "Cash",
        bankName: "Indian Bank",
        bankLocation: "Kinathukadavu",
        remarks: "first payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
          hostel: 0,
          transport: 0,
        }],
      });
    expect(res.status).toBe(201);
  });

  it("records second payment with decimals (UPI)", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptTwo,
        paymentType: "UPI",
        remarks: "second payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 250.5, exam: 100.25, erp: 0, book: 0, lab: 0 },
          hostel: 0,
          transport: 0,
        }],
      });
    expect(res.status).toBe(201);
  });

  it("verifies partial payment after first two payments cannot exceed remaining", async () => {
    // After paying 1250.5 tuition (1000+250.5), try to pay tuition exceeding remaining
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const tuitionRemaining = yr.academic.odd.tuition.total - yr.academic.odd.tuition.paid;

    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `OVER2-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: tuitionRemaining + 1 },
        }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tuition.*exceeds/i);
  });

  it("records third payment (Card, within remaining due)", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptThree,
        paymentType: "Card",
        bankName: "SBI",
        remarks: "third payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 100, exam: 0, erp: 50, book: 50, lab: 50 },
        }],
      });
    expect(res.status).toBe(201);
  });

  it("records payment to hostel student's hostel and academic", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollHostel,
        receiptNo: `HPAY-${testCtx.TS.slice(-5)}`,
        paymentType: "DD",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 500 },
          hostel: 1000,
        }],
      });
    expect(res.status).toBe(201);

    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.hostel.total.paid).toBe(1000);
    expect(yr.hostel.total.status).toBe("Partially Paid");
    expect(yr.academic.odd.tuition.paid).toBe(500);
  });

  /* ─── FEE TRACKING STATUS TRANSITIONS ───── */

  it("updates fee tracking paid totals after payments", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollFinance });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.total.paid).toBeGreaterThan(0);
    expect(yr.academic.odd.tuition.paid).toBeGreaterThan(0);
    expect(yr.academic.odd.tuition.status).toBe("Partially Paid");
    expect(yr.total.status).toBe("Partially Paid");
  });

  /* ─── GET TRANSACTIONS ───── */

  it("gets student transactions (200)", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 404 for missing transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/95CS995")
      .set(adminAuth());
    expect(res.status).toBe(404);
  });

  /* ─── RECENT PAYMENTS ───── */

  it("gets recent payments without filters", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("gets recent payments filtered by year", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("gets recent payments filtered by department", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
  });

  it("gets recent payments filtered by paymentMode", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ paymentMode: "UPI" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("gets recent payments filtered by limit", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it("gets recent payments with combined filters", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({
        year: testCtx.academicYearPrimary,
        department: "CSE",
        paymentMode: "Cash",
        limit: 2,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it("gets recent payments filtered by date range", async () => {
    const today = new Date();
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({
        fromDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(),
        toDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(),
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("gets recent payments with only fromDate", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ fromDate: "2020-01-01" });
    expect(res.status).toBe(200);
  });

  it("gets recent payments with only toDate", async () => {
    const res = await request(app)
      .get("/api/feePayment/recent")
      .set(adminAuth())
      .query({ toDate: new Date().toISOString() });
    expect(res.status).toBe(200);
  });
});
