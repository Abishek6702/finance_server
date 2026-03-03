const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
  ReceiptRecallRequest,
} = require("./setup");

describe("Receipt Recall API", () => {
  let recallReceiptNo;
  let recallRollNo;
  let createdRecallId;
  let trackingBeforePayment;

  beforeAll(async () => {
    await globalSetup();

    recallRollNo = testCtx.studentRollRecall;
    recallReceiptNo = testCtx.receiptRecall;

    // Create fee structure (reuse primary academic year)
    await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

    // Create a student for recall tests
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(recallRollNo, { academicYear: testCtx.academicYearPrimary }));

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
        receiptNo: recallReceiptNo,
        paymentType: "Cash",
        bankName: "Test Bank",
        remarks: "payment to be recalled",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    expect(payRes.status).toBe(201);
  });

  afterAll(async () => {
    // Cleanup recall-specific data
    await ReceiptRecallRequest.deleteMany({ rollNo: recallRollNo });
    await StudentTransaction.deleteMany({ rollNo: recallRollNo });
    await StudentFeeTracking.deleteMany({ rollNo: recallRollNo });
    await Student.deleteMany({ "personal.rollNo": recallRollNo });
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  /* ─── VALIDATION ───── */

  it("rejects recall request without auth token", async () => {
    const res = await request(app).post("/api/receiptRecall").send({});
    expect(res.status).toBe(401);
  });

  it("rejects recall request with missing fields", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects recall request with missing reason", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it("rejects recall for non-existent receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: "NONEXISTENT-999", rollNo: recallRollNo, reason: "test" });
    expect(res.status).toBe(404);
  });

  it("rejects recall for non-existent student", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: "99ZZ999", reason: "test" });
    expect(res.status).toBe(404);
  });

  /* ─── CREATE RECALL REQUEST ───── */

  it("admin creates recall request successfully", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "Incorrect payment entry",
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.receiptNo).toBe(recallReceiptNo);
    expect(res.body.data.rollNo).toBe(recallRollNo);
    expect(res.body.data.receiptSnapshot).toBeDefined();
    expect(res.body.data.receiptSnapshot.breakdowns).toBeDefined();
    createdRecallId = res.body.data._id;
  });

  it("rejects duplicate recall for same receipt (already PENDING)", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "Duplicate attempt",
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/pending.*already/i);
  });

  /* ─── LIST RECALL REQUESTS ───── */

  it("lists recall requests", async () => {
    const res = await request(app)
      .get("/api/receiptRecall")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.requests)).toBe(true);
    expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  it("filters recall requests by status", async () => {
    const res = await request(app)
      .get("/api/receiptRecall")
      .set(adminAuth())
      .query({ status: "PENDING" });
    expect(res.status).toBe(200);
    res.body.data.requests.forEach(r => {
      expect(r.status).toBe("PENDING");
    });
  });

  it("rejects invalid status filter", async () => {
    const res = await request(app)
      .get("/api/receiptRecall")
      .set(adminAuth())
      .query({ status: "INVALID" });
    expect(res.status).toBe(400);
  });

  /* ─── ROLE VALIDATION ───── */

  it("admin cannot approve recall (requires superadmin)", async () => {
    const res = await request(app)
      .post(`/api/receiptRecall/${createdRecallId}/approve`)
      .set(adminAuth());
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it("admin cannot reject recall (requires superadmin)", async () => {
    const res = await request(app)
      .post(`/api/receiptRecall/${createdRecallId}/reject`)
      .set(adminAuth());
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  /* ─── REJECTION FLOW ───── */

  it("rejects approval/rejection of non-existent recall", async () => {
    const fakeId = "000000000000000000000000";
    const res = await request(app)
      .post(`/api/receiptRecall/${fakeId}/approve`)
      .set(superadminAuth());
    expect(res.status).toBe(404);
  });

  it("superadmin rejects recall → no payment changes", async () => {
    // Snapshot tracking before rejection
    const trackingBefore = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrBefore = trackingBefore.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const tuitionPaidBefore = yrBefore.academic.odd.tuition.paid;

    const res = await request(app)
      .post(`/api/receiptRecall/${createdRecallId}/reject`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
    expect(res.body.data.reviewedBy).toBeDefined();
    expect(res.body.data.reviewedAt).toBeDefined();

    // Verify no changes to fee tracking
    const trackingAfter = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrAfter = trackingAfter.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yrAfter.academic.odd.tuition.paid).toBe(tuitionPaidBefore);

    // Verify receipt still exists
    const txn = await StudentTransaction.findOne({ rollNo: recallRollNo });
    const receipt = txn.transactions.find(t => t.receiptNo === recallReceiptNo);
    expect(receipt).toBeDefined();
  });

  it("rejects double rejection (already REJECTED)", async () => {
    const res = await request(app)
      .post(`/api/receiptRecall/${createdRecallId}/reject`)
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/REJECTED/);
  });

  /* ─── APPROVAL + ROLLBACK FLOW ───── */

  let approvalRecallId;

  it("creates a new recall request for approval testing", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "Need to reverse payment for approval test",
      });
    expect(res.status).toBe(201);
    approvalRecallId = res.body.data._id;
  });

  it("superadmin approves recall → receipt deleted + tracking restored", async () => {
    const res = await request(app)
      .post(`/api/receiptRecall/${approvalRecallId}/approve`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("COMPLETED");
    expect(res.body.data.reviewedBy).toBeDefined();
    expect(res.body.data.reviewedAt).toBeDefined();
    expect(res.body.data.completedAt).toBeDefined();
  });

  it("verifies receipt no longer exists after approval", async () => {
    const txn = await StudentTransaction.findOne({ rollNo: recallRollNo });
    if (txn) {
      const receipt = txn.transactions.find(t => t.receiptNo === recallReceiptNo);
      expect(receipt).toBeUndefined();
    }
  });

  it("verifies fee tracking values match pre-payment state after recall", async () => {
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

  it("rejects approval of already-completed recall", async () => {
    const res = await request(app)
      .post(`/api/receiptRecall/${approvalRecallId}/approve`)
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/COMPLETED/);
  });

  /* ─── SECOND PAYMENT + RECALL CYCLE ───── */

  let secondReceiptNo;
  let secondRecallId;
  let trackingBeforeSecondPayment;

  it("makes a second payment and recalls it correctly", async () => {
    secondReceiptNo = `${recallReceiptNo}-2`;

    // Make another payment
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: recallRollNo,
        receiptNo: secondReceiptNo,
        paymentType: "UPI",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 500, exam: 200 },
        }],
      });
    expect(payRes.status).toBe(201);

    // Snapshot before recall
    const trackingPre = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrPre = trackingPre.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    trackingBeforeSecondPayment = {
      tuitionPaid: yrPre.academic.odd.tuition.paid,
      examPaid: yrPre.academic.odd.exam.paid,
    };

    // Create recall
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: secondReceiptNo, rollNo: recallRollNo, reason: "Second recall test" });
    expect(recallRes.status).toBe(201);
    secondRecallId = recallRes.body.data._id;

    // Approve
    const approveRes = await request(app)
      .post(`/api/receiptRecall/${secondRecallId}/approve`)
      .set(superadminAuth());
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("COMPLETED");

    // Verify tracking reversed correctly
    const trackingAfter = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrAfter = trackingAfter.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yrAfter.academic.odd.tuition.paid).toBe(trackingBeforeSecondPayment.tuitionPaid - 500);
    expect(yrAfter.academic.odd.exam.paid).toBe(trackingBeforeSecondPayment.examPaid - 200);

    // Verify receipt is gone
    const txn = await StudentTransaction.findOne({ rollNo: recallRollNo });
    if (txn) {
      const receipt = txn.transactions.find(t => t.receiptNo === secondReceiptNo);
      expect(receipt).toBeUndefined();
    }
  });

  it("rejects recall for already-recalled receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, reason: "Should fail" });
    expect(res.status).toBeGreaterThanOrEqual(404);
  });
});
