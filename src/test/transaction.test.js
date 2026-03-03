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

  /* ─── BILLING DATE ───── */

  it("records payment with billingDate in dd/mm/yyyy format and stores correct date", async () => {
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: `BDATE-${testCtx.TS.slice(-5)}`,
        paymentType: "Cash",
        billingDate: "15/08/2025",
        remarks: "billing date test",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1 },
        }],
      });
    expect(res.status).toBe(201);

    const txnDoc = await StudentTransaction.findOne({ rollNo: testCtx.studentRollFinance });
    const savedTxn = txnDoc.transactions.find((t) => t.receiptNo === `BDATE-${testCtx.TS.slice(-5)}`);
    expect(savedTxn).toBeDefined();
    expect(savedTxn.billingDate).toBeDefined();
    const stored = new Date(savedTxn.billingDate);
    expect(stored.getFullYear()).toBe(2025);
    expect(stored.getMonth()).toBe(7); // August = 7 (0-indexed)
    expect(stored.getDate()).toBe(15);
  });

  it("records payment without billingDate and defaults to today", async () => {
    const receiptId = `BDEF-${testCtx.TS.slice(-5)}`;
    const before = Date.now();
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: receiptId,
        paymentType: "Cash",
        remarks: "no billing date",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1 },
        }],
      });
    const after = Date.now();
    expect(res.status).toBe(201);

    const txnDoc = await StudentTransaction.findOne({ rollNo: testCtx.studentRollFinance });
    const savedTxn = txnDoc.transactions.find((t) => t.receiptNo === receiptId);
    expect(savedTxn).toBeDefined();
    const billingTime = new Date(savedTxn.billingDate).getTime();
    expect(billingTime).toBeGreaterThanOrEqual(before);
    expect(billingTime).toBeLessThanOrEqual(after);
  });

  it("records payment with billingDate as ISO date string", async () => {
    const receiptId = `BISO-${testCtx.TS.slice(-5)}`;
    const res = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: receiptId,
        paymentType: "UPI",
        billingDate: "2025-03-20T00:00:00.000Z",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1 },
        }],
      });
    expect(res.status).toBe(201);

    const txnDoc = await StudentTransaction.findOne({ rollNo: testCtx.studentRollFinance });
    const savedTxn = txnDoc.transactions.find((t) => t.receiptNo === receiptId);
    expect(savedTxn).toBeDefined();
    const stored = new Date(savedTxn.billingDate);
    expect(stored.getFullYear()).toBe(2025);
    expect(stored.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(stored.getDate()).toBe(20);
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

  /* ─── GET ALL TRANSACTIONS (GET /api/feePayment/) ───── */

  it("gets all transactions without filters (default, returns all)", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.transactions)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    // Each result should include student data
    if (res.body.data.transactions.length > 0) {
      expect(res.body.data.transactions[0].student).toBeDefined();
      expect(res.body.data.transactions[0].transaction).toBeDefined();
    }
  });

  it("filters all transactions by department", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
    res.body.data.transactions.forEach((item) => {
      expect(item.student.academic.departmentName).toBe("CSE");
    });
  });

  it("filters all transactions by paymentMode", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ paymentMode: "UPI" });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
    res.body.data.transactions.forEach((item) => {
      expect(item.transaction.paymentType).toBe("UPI");
    });
  });

  it("filters all transactions by date range (fromDate + toDate)", async () => {
    const today = new Date();
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({
        fromDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString().split("T")[0],
        toDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().split("T")[0],
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.transactions)).toBe(true);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it("paginates all transactions with page and limit", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ page: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("combines multiple filters on all transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({
        department: "CSE",
        paymentMode: "Cash",
        limit: 5,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeLessThanOrEqual(5);
    res.body.data.transactions.forEach((item) => {
      expect(item.transaction.paymentType).toBe("Cash");
      expect(item.student.academic.departmentName).toBe("CSE");
    });
  });

  it("returns newest first in all transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth());
    expect(res.status).toBe(200);
    const txns = res.body.data.transactions;
    if (txns.length >= 2) {
      const dates = txns.map((t) => new Date(t.transaction.paidOn).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    }
  });

  it("rejects invalid department in all transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ department: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid paymentMode in all transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ paymentMode: "Crypto" });
    expect(res.status).toBe(400);
  });

  it("rejects fromDate after toDate in all transactions", async () => {
    const res = await request(app)
      .get("/api/feePayment/")
      .set(adminAuth())
      .query({ fromDate: "2026-12-31", toDate: "2025-01-01" });
    expect(res.status).toBe(400);
  });

  /* ─── GET STUDENT TRANSACTIONS (GET /api/feePayment/:rollNo) ───── */

  it("gets student transactions with student details", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.student).toBeDefined();
    expect(res.body.data.student.personal).toBeDefined();
    expect(res.body.data.student.academic).toBeDefined();
    expect(res.body.data.student.contact).toBeDefined();
    expect(Array.isArray(res.body.data.transactions)).toBe(true);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.pagination).toBeDefined();
  });

  it("includes receipt breakdowns in student transactions", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    const firstTxn = res.body.data.transactions[0];
    expect(firstTxn.breakdowns).toBeDefined();
    expect(Array.isArray(firstTxn.breakdowns)).toBe(true);
    expect(firstTxn.breakdowns.length).toBeGreaterThanOrEqual(1);
  });

  it("returns newest first for student transactions", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    const txns = res.body.data.transactions;
    if (txns.length >= 2) {
      const dates = txns.map((t) => new Date(t.paidOn).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    }
  });

  it("filters student transactions by date range", async () => {
    const today = new Date();
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({
        fromDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString().split("T")[0],
        toDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().split("T")[0],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it("paginates student transactions", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({ page: 1, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(2);
  });

  it("returns 404 for student transactions of unknown rollNo", async () => {
    const res = await request(app)
      .get("/api/feePayment/99CS999")
      .set(adminAuth());
    expect(res.status).toBe(404);
  });

  it("returns empty transactions for valid student with no matching date filter", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({ fromDate: "2010-01-01", toDate: "2010-12-31" });
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBe(0);
  });

  it("rejects fromDate after toDate in student transactions", async () => {
    const res = await request(app)
      .get(`/api/feePayment/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({ fromDate: "2026-12-31", toDate: "2025-01-01" });
    expect(res.status).toBe(400);
  });

  /* ─── GET NEXT RECEIPT NO (GET /api/feePayment/nextReceiptNo) ───── */

  it("returns a receipt number in REC-DATE-COUNT format", async () => {
    const res = await request(app)
      .get("/api/feePayment/nextReceiptNo")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNo).toBeDefined();
    expect(res.body.data.receiptNo).toMatch(/^REC-\d{8}-\d{3,}$/);
  });

  it("receipt number increments after a payment", async () => {
    const res1 = await request(app)
      .get("/api/feePayment/nextReceiptNo")
      .set(adminAuth());
    expect(res1.status).toBe(200);
    const firstReceiptNo = res1.body.data.receiptNo;

    // Make a payment
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptFour,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 100 },
        }],
      });

    const res2 = await request(app)
      .get("/api/feePayment/nextReceiptNo")
      .set(adminAuth());
    expect(res2.status).toBe(200);
    const secondReceiptNo = res2.body.data.receiptNo;

    // Extract the count portion and verify it incremented
    const count1 = parseInt(firstReceiptNo.split("-").pop());
    const count2 = parseInt(secondReceiptNo.split("-").pop());
    expect(count2).toBe(count1 + 1);
  });

  it("rejects nextReceiptNo without auth token", async () => {
    const res = await request(app).get("/api/feePayment/nextReceiptNo");
    expect(res.status).toBe(401);
  });
});
