const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");
const mongoose = require("mongoose");

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
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ rollNo });
    expect(trackRes.status).toBe(200);

    const record = trackRes.body.data[0];
    const yearEntry = record.academicYears.find(
      (row) => row.academicYear === testCtx.academicYearPrimary
    );
    const oddTuition = yearEntry.odd.feeHeads.find((h) => h.name === "Tuition Fees");
    const grossTuition = oddTuition.total + oddTuition.concession;
    const netTuition = oddTuition.total;

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

  it("accepts excessAmount payment when student has sufficient excess", async () => {
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
        isExcessAmountTrue: false,
      },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "excessAmount",
        excessAmount: 0,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000 },
        }],
      });

    expect(payRes.status).toBe(201);

    const updatedStudent = await Student.findOne({ "personal.rollNo": rollNo }).lean();
    expect(updatedStudent.enrollment.excessAmount).toBeCloseTo(9000, 2);
    expect(updatedStudent.enrollment.isExcessAmountTrue).toBe(true);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  it("adds excessAmount balance on non-excess payment", async () => {
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
        excessAmount: 0,
        isExcessAmountTrue: false,
      },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "Cash",
        excessAmount: 5000,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000 },
        }],
      });

    expect(payRes.status).toBe(201);

    const updatedStudent = await Student.findOne({ "personal.rollNo": rollNo }).lean();
    expect(updatedStudent.enrollment.excessAmount).toBeCloseTo(5000, 2);
    expect(updatedStudent.enrollment.isExcessAmountTrue).toBe(true);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  it("rejects excessAmount payment when balance is zero", async () => {
    const rollNo = `32CS${testCtx.TS.slice(-3)}`;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      enrollment: {
        quota: "Government Quota",
        firstGraduate: { isApplicable: false },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
        excessAmount: 0,
        isExcessAmountTrue: false,
      },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "excessAmount",
        excessAmount: 0,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000 },
        }],
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.message).toMatch(/excess amount is not available/i);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  it("rejects reduction payment without reductionId", async () => {
    const rollNo = `33CS${testCtx.TS.slice(-3)}`;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
    });
    expect([200, 201]).toContain(stuRes.status);

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "reduction",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          transport: 1000,
        }],
      });

    expect(payRes.status).toBe(400);
    expect(payRes.body.message).toMatch(/reductionid is required/i);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  it("accepts reduction payment with reductionId and stores it", async () => {
    const rollNo = `34CS${testCtx.TS.slice(-3)}`;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
    });
    expect([200, 201]).toContain(stuRes.status);

    const reductionId = new mongoose.Types.ObjectId().toString();

    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "reduction",
        reductionId,
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          hostel: 1500,
        }],
      });

    expect(payRes.status).toBe(201);

    const txDoc = await StudentTransaction.findOne({ rollNo }).lean();
    const latestTx = txDoc.transactions[txDoc.transactions.length - 1];
    expect(latestTx.paymentType).toBe("reduction");
    expect(String(latestTx.reductionId)).toBe(reductionId);

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
        expect(row).toHaveProperty("reductionReasonId");
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
      expect(d).toHaveProperty("reductionReasonId");
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

  describe("Acknowledgement API", () => {
    let ackReceiptNo;
    const testAckRollNo = `35CS${testCtx.TS.slice(-3)}`;

    beforeAll(async () => {
      // Create student for ack tests
      const stuRes = await createStudent(testAckRollNo, { academicYear: testCtx.academicYearPrimary });
      expect([200, 201, 409]).toContain(stuRes.status);
    });

    afterAll(async () => {
      await Promise.all([
        StudentTransaction.deleteMany({ rollNo: testAckRollNo }),
        StudentFeeTracking.deleteMany({ rollNo: testAckRollNo }),
        Student.deleteMany({ "personal.rollNo": testAckRollNo }),
        // We must also delete StudentAcknoledgement but we might need to import it. Let's just rely on teardown or clean it via mongoose directly.
        require("../api/fee-payment/payments/model/modelAcknoledgement").deleteMany({ rollNo: testAckRollNo })
      ]);
    });

    it("POST /api/feePayment/ack creates an acknowledgement without altering balance", async () => {
      const payRes = await request(app)
        .post("/api/feePayment/ack")
        .set(adminAuth())
        .send({
          rollNo: testAckRollNo,
          paymentType: "DD",
          bankName: "Test Bank",
          bankLocation: "Test City",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 1, tuition: 1500 },
          }],
        });

      expect(payRes.status).toBe(201);
      ackReceiptNo = payRes.body.data;

      // Verify transaction is NOT created
      const txDoc = await StudentTransaction.findOne({ rollNo: testAckRollNo });
      expect(txDoc).toBeNull();
      
      // Verify ack record exists
      const AckModel = require("../api/fee-payment/payments/model/modelAcknoledgement");
      const ackDoc = await AckModel.findOne({ rollNo: testAckRollNo });
      expect(ackDoc).not.toBeNull();
      expect(ackDoc.acknoledgements.length).toBe(1);
      expect(ackDoc.acknoledgements[0].status).toBe("RECEIVED");
    });

    it("PUT /api/feePayment/ack rejects acknowledgement with REJECTED status", async () => {
      const putRes = await request(app)
        .put("/api/feePayment/ack")
        .set(adminAuth())
        .send({
          rollNo: testAckRollNo,
          receiptNo: ackReceiptNo,
          status: "REJECTED"
        });

      expect(putRes.status).toBe(200);

      // Verify ack record updated
      const AckModel = require("../api/fee-payment/payments/model/modelAcknoledgement");
      const ackDoc = await AckModel.findOne({ rollNo: testAckRollNo });
      expect(ackDoc.acknoledgements[0].status).toBe("REJECTED");
    });

    it("PUT /api/feePayment/ack accepts acknowledgement with SUCCESSFUL status when re-created", async () => {
      // Create another ack
      const payRes = await request(app)
        .post("/api/feePayment/ack")
        .set(adminAuth())
        .send({
          rollNo: testAckRollNo,
          paymentType: "Cheque",
          bankName: "Test Bank 2",
          bankLocation: "Test City",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 1, tuition: 500 },
          }],
        });
      
      expect(payRes.status).toBe(201);
      const newAckReceiptNo = payRes.body.data;

      const putRes = await request(app)
        .put("/api/feePayment/ack")
        .set(adminAuth())
        .send({
          rollNo: testAckRollNo,
          receiptNo: newAckReceiptNo,
          status: "SUCCESSFUL"
        });

      expect(putRes.status).toBe(200);

      // Verify transaction IS created
      const txDoc = await StudentTransaction.findOne({ rollNo: testAckRollNo });
      expect(txDoc).not.toBeNull();
      expect(txDoc.transactions.length).toBe(1);
      expect(txDoc.transactions[0].receiptNo).toBe(newAckReceiptNo);
      
      // Verify tracking updated
      const tracking = await StudentFeeTracking.findOne({ rollNo: testAckRollNo });
      const yearEntry = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
      expect(yearEntry.academic.total.paid).toBe(500);
      expect(yearEntry.academic.odd.tuition.paid).toBe(500);
    });
  });

});
