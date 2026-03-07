const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
  ReceiptRecallRequest,
} = require("./setup");

describe("Receipt Recall API", () => {
  let recallReceiptNo;
  let recallRollNo;
  let breakdownIdsFromReceipt;
  let trackingBeforePayment;

  beforeAll(async () => {
    await globalSetup();

    recallRollNo = testCtx.studentRollRecall;

    // Create fee structure (reuse primary academic year)
    await createFeeStructure(testCtx.academicYearPrimary);

    // Create a student for recall tests
    await createStudent(recallRollNo, { academicYear: testCtx.academicYearPrimary });

    // Snapshot fee tracking BEFORE any payment
    const trackingPre = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrPre = trackingPre.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    trackingBeforePayment = {
      tuitionPaid: yrPre.academic.odd.tuition.paid,
      examPaid: yrPre.academic.odd.exam.paid,
      erpPaid: yrPre.academic.odd.erp.paid,
      bookPaid: yrPre.academic.odd.book.paid,
      labPaid: yrPre.academic.odd.lab.paid,
      semTotalPaid: yrPre.academic.odd.total.paid,
      academicTotalPaid: yrPre.academic.total.paid,
      yearTotalPaid: yrPre.total.paid,
    };

    // Make a payment that we will later recall
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: recallRollNo,
        paymentType: "Cash",
        bankName: "Test Bank",
        remarks: "payment to be recalled",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    expect(payRes.status).toBe(201);

    // Capture the auto-generated receiptNo and breakdown _ids
    const txns = payRes.body.data.transactions;
    const lastTxn = txns[txns.length - 1];
    recallReceiptNo = lastTxn.receiptNo;
    breakdownIdsFromReceipt = lastTxn.breakdowns.map(b => b._id);
  });

  afterAll(async () => {
    await Promise.all([
      ReceiptRecallRequest.deleteMany({ rollNo: recallRollNo }),
      StudentTransaction.deleteMany({ rollNo: recallRollNo }),
      StudentFeeTracking.deleteMany({ rollNo: recallRollNo }),
      Student.deleteMany({ "personal.rollNo": recallRollNo }),
      FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary }),
    ]);
    await globalTeardown();
  });

  /* ─── VALIDATION ───── */

  it("rejects recall without auth token", async () => {
    const res = await request(app).post("/api/receiptRecall").send({});
    expect(res.status).toBe(401);
  });

  it("rejects recall with missing fields", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects recall with missing reason", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, breakdownIds: breakdownIdsFromReceipt });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it("rejects recall with empty breakdownIds", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, reason: "test", breakdownIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/breakdownIds/i);
  });

  it("rejects recall with invalid breakdownId", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, reason: "test", breakdownIds: ["not-valid"] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid breakdownId/i);
  });

  it("rejects recall for non-existent receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: "NONEXISTENT-999", rollNo: recallRollNo, reason: "test", breakdownIds: breakdownIdsFromReceipt });
    expect(res.status).toBe(404);
  });

  it("rejects recall for non-existent student", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: "99ZZ999", reason: "test", breakdownIds: breakdownIdsFromReceipt });
    expect(res.status).toBe(404);
  });

  it("rejects recall for non-existent breakdown ID in receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "test",
        breakdownIds: ["000000000000000000000000"],
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Breakdown.*not found/i);
  });

  /* ─── RECALL ALL BREAKDOWNS (removes entire receipt) ───── */

  it("admin recalls all breakdowns → receipt deleted + tracking restored", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "Incorrect payment entry",
        breakdownIds: breakdownIdsFromReceipt,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNo).toBe(recallReceiptNo);
    expect(res.body.data.rollNo).toBe(recallRollNo);
    expect(res.body.data.breakdownIds).toHaveLength(breakdownIdsFromReceipt.length);
    expect(res.body.data.breakdownSnapshots).toBeDefined();
    expect(res.body.data.breakdownSnapshots).toHaveLength(breakdownIdsFromReceipt.length);
    // Receipt metadata must be preserved in the recall record
    expect(res.body.data.paymentType).toBe("Cash");
    expect(typeof res.body.data.totalAmount).toBe("number");
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
    // Student snapshot must be stored
    expect(res.body.data.studentInfo).toBeDefined();
    expect(res.body.data.studentInfo.departmentName).toBe("CSE");
    expect(res.body.data.studentInfo.currentAcademicYear).toBe(testCtx.academicYearPrimary);
    expect(typeof res.body.data.studentInfo.yearStudying).toBe("number");
    expect(typeof res.body.data.studentInfo.currentSemesterNumber).toBe("number");
  });

  it("verifies receipt no longer exists after full recall", async () => {
    const txn = await StudentTransaction.findOne({ rollNo: recallRollNo });
    if (txn) {
      const receipt = txn.transactions.find(t => t.receiptNo === recallReceiptNo);
      expect(receipt).toBeUndefined();
    }
  });

  it("verifies fee tracking values match pre-payment state after full recall", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);

    expect(yr.academic.odd.tuition.paid).toBe(trackingBeforePayment.tuitionPaid);
    expect(yr.academic.odd.exam.paid).toBe(trackingBeforePayment.examPaid);
    expect(yr.academic.odd.erp.paid).toBe(trackingBeforePayment.erpPaid);
    expect(yr.academic.odd.book.paid).toBe(trackingBeforePayment.bookPaid);
    expect(yr.academic.odd.lab.paid).toBe(trackingBeforePayment.labPaid);
    expect(yr.academic.odd.total.paid).toBe(trackingBeforePayment.semTotalPaid);
    expect(yr.academic.total.paid).toBe(trackingBeforePayment.academicTotalPaid);
    expect(yr.total.paid).toBe(trackingBeforePayment.yearTotalPaid);
  });

  it("rejects recall for already-recalled breakdowns", async () => {
    // Re-pay so the receipt exists again
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: recallRollNo,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 200 },
        }],
      });
    expect(payRes.status).toBe(201);
    const newTxns = payRes.body.data.transactions;
    const newReceipt = newTxns[newTxns.length - 1];
    const newBdIds = newReceipt.breakdowns.map(b => b._id);

    // Recall it
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: newReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "test",
        breakdownIds: newBdIds,
      });
    expect(recallRes.status).toBe(201);

    // Try to recall again — should 409
    const dupeRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: newReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "duplicate attempt",
        breakdownIds: newBdIds,
      });
    expect(dupeRes.status).toBe(409);
    expect(dupeRes.body.message).toMatch(/already.*recalled/i);
  });

  /* ─── PARTIAL RECALL (individual breakdown) ───── */

  it("recalls a single breakdown from a multi-breakdown receipt", async () => {
    // Make a payment with 2 breakdowns (odd + even semester)
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: recallRollNo,
        paymentType: "UPI",
        breakdowns: [
          {
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 1, tuition: 300, exam: 100 },
          },
          {
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 2, tuition: 400 },
          },
        ],
      });
    expect(payRes.status).toBe(201);

    const txns = payRes.body.data.transactions;
    const multiReceipt = txns[txns.length - 1];
    expect(multiReceipt.breakdowns).toHaveLength(2);

    // Snapshot tracking before partial recall
    const trackingBefore = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrBefore = trackingBefore.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const oddTuitionBefore = yrBefore.academic.odd.tuition.paid;
    const evenTuitionBefore = yrBefore.academic.even.tuition.paid;

    // Recall only the first breakdown (sem 1: tuition 300 + exam 100)
    const firstBdId = multiReceipt.breakdowns[0]._id;
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: multiReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "Partial recall test",
        breakdownIds: [firstBdId],
      });
    expect(recallRes.status).toBe(201);
    expect(recallRes.body.data.breakdownIds).toHaveLength(1);

    // Verify the receipt still exists with only the second breakdown
    const txnAfter = await StudentTransaction.findOne({ rollNo: recallRollNo });
    const receiptAfter = txnAfter.transactions.find(t => t.receiptNo === multiReceipt.receiptNo);
    expect(receiptAfter).toBeDefined();
    expect(receiptAfter.breakdowns).toHaveLength(1);
    expect(receiptAfter.breakdowns[0]._id.toString()).toBe(multiReceipt.breakdowns[1]._id);

    // Verify fee tracking: sem 1 reversed, sem 2 untouched
    const trackingAfter = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrAfter = trackingAfter.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yrAfter.academic.odd.tuition.paid).toBe(oddTuitionBefore - 300);
    expect(yrAfter.academic.even.tuition.paid).toBe(evenTuitionBefore); // untouched
  });

  /* ─── LIST RECALLS ───── */

  it("lists recall records", async () => {
    const res = await request(app)
      .get("/api/receiptRecall")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.records)).toBe(true);
    expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  it("filters recall records by rollNo", async () => {
    const res = await request(app)
      .get("/api/receiptRecall")
      .set(adminAuth())
      .query({ rollNo: recallRollNo });
    expect(res.status).toBe(200);
    res.body.data.records.forEach(r => {
      expect(r.rollNo).toBe(recallRollNo);
    });
  });
});
