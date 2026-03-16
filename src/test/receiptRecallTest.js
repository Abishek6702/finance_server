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
  let feeHeadIdsFromReceipt;  // IDs of individual feeHead subdocs
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
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    expect(payRes.status).toBe(201);

    // Capture the auto-generated receiptNo and all feeHead _ids
    recallReceiptNo = payRes.body.data;
    // Fetch transaction details to extract feeHead _ids
    const txnRes = await request(app).get(`/api/feePayment/${recallRollNo}`).set(adminAuth());
    const txns = txnRes.body.data.transactions;
    const lastTxn = txns.find(t => t.receiptNo === recallReceiptNo);
    // Each non-zero fee head is a subdoc with its own _id
    feeHeadIdsFromReceipt = lastTxn.breakdowns.flatMap(bd => Object.values(bd.feeHeads).map(fh => fh._id));
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

  /* â”€â”€â”€ VALIDATION â”€â”€â”€â”€â”€ */

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
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, feeHeadIds: feeHeadIdsFromReceipt });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it("rejects recall with empty feeHeadIds", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, reason: "test", feeHeadIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/feeHeadIds/i);
  });

  it("rejects recall with invalid feeHeadId", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: recallRollNo, reason: "test", feeHeadIds: ["not-valid"] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid feeHeadId/i);
  });

  it("rejects recall for non-existent receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: "NONEXISTENT-999", rollNo: recallRollNo, reason: "test", feeHeadIds: feeHeadIdsFromReceipt });
    expect(res.status).toBe(404);
  });

  it("rejects recall for non-existent student", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({ receiptNo: recallReceiptNo, rollNo: "99ZZ999", reason: "test", feeHeadIds: feeHeadIdsFromReceipt });
    expect(res.status).toBe(404);
  });

  it("rejects recall for non-existent feeHead ID in receipt", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "test",
        feeHeadIds: ["000000000000000000000000"],
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/FeeHead.*not found/i);
  });

  /* â”€â”€â”€ RECALL ALL FEE HEADS (removes entire receipt) â”€â”€â”€â”€â”€ */

  it("admin recalls all fee heads â†’ receipt deleted + tracking restored", async () => {
    const res = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: recallReceiptNo,
        rollNo: recallRollNo,
        reason: "Incorrect payment entry",
        feeHeadIds: feeHeadIdsFromReceipt,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNo).toBe(recallReceiptNo);
    expect(res.body.data.rollNo).toBe(recallRollNo);
    expect(res.body.data.feeHeadIds).toHaveLength(feeHeadIdsFromReceipt.length);
    expect(res.body.data.feeHeadSnapshots).toBeDefined();
    expect(res.body.data.feeHeadSnapshots).toHaveLength(feeHeadIdsFromReceipt.length);
    // Each snapshot must carry type, fee, academicYear, semesterNumber
    const snap = res.body.data.feeHeadSnapshots[0];
    expect(snap).toHaveProperty("type");
    expect(snap).toHaveProperty("fee");
    expect(snap).toHaveProperty("academicYear");
    // Receipt metadata must be preserved
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

  it("rejects recall for already-recalled fee heads", async () => {
    // Re-pay so we have a receipt with fee heads again
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
    const newReceiptNo = payRes.body.data;
    const newTxnRes = await request(app).get(`/api/feePayment/${recallRollNo}`).set(adminAuth());
    const newReceipt = newTxnRes.body.data.transactions.find(t => t.receiptNo === newReceiptNo);
    const newFhIds = newReceipt.breakdowns.flatMap(bd => Object.values(bd.feeHeads).map(fh => fh._id));

    // Recall it
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: newReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "test",
        feeHeadIds: newFhIds,
      });
    expect(recallRes.status).toBe(201);

    // Try to recall again â€” should 409
    const dupeRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: newReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "duplicate attempt",
        feeHeadIds: newFhIds,
      });
    expect(dupeRes.status).toBe(409);
    expect(dupeRes.body.message).toMatch(/already.*recalled/i);
  });

  /* â”€â”€â”€ PARTIAL RECALL (single fee head from a breakdown) â”€â”€â”€â”€â”€ */

  it("recalls a single fee head (exam) leaving other fee heads intact", async () => {
    // Make a payment with 2 fee heads: tuition + exam for sem1
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
        ],
      });
    expect(payRes.status).toBe(201);
    const targetReceiptNo = payRes.body.data;
    const txnRes = await request(app).get(`/api/feePayment/${recallRollNo}`).set(adminAuth());
    const targetReceipt = txnRes.body.data.transactions.find(t => t.receiptNo === targetReceiptNo);
    // Should have one breakdown with 2 fee heads (tuition + exam)
    expect(targetReceipt.breakdowns).toHaveLength(1);
    expect(Object.keys(targetReceipt.breakdowns[0].feeHeads)).toHaveLength(2);

    // Snapshot tracking before partial recall
    const trackingBefore = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrBefore = trackingBefore.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const oddTuitionBefore = yrBefore.academic.odd.tuition.paid;
    const oddExamBefore = yrBefore.academic.odd.exam.paid;

    // Find the exam feeHead _id
    const examFeeHead = targetReceipt.breakdowns[0].feeHeads['exam'];
    expect(examFeeHead).toBeDefined();

    // Recall only the exam fee head
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: targetReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "Partial recall â€” exam only",
        feeHeadIds: [examFeeHead._id],
      });
    expect(recallRes.status).toBe(201);
    expect(recallRes.body.data.feeHeadIds).toHaveLength(1);

    // Receipt still exists with one fee head remaining (tuition)
    const txnAfter = await StudentTransaction.findOne({ rollNo: recallRollNo });
    const receiptAfter = txnAfter.transactions.find(t => t.receiptNo === targetReceipt.receiptNo);
    expect(receiptAfter).toBeDefined();
    expect(receiptAfter.breakdowns[0].feeHeads).toHaveLength(1);
    expect(receiptAfter.breakdowns[0].feeHeads[0].type).toBe("tuition");

    // Verify tracking: exam reversed, tuition untouched
    const trackingAfter = await StudentFeeTracking.findOne({ rollNo: recallRollNo }).lean();
    const yrAfter = trackingAfter.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yrAfter.academic.odd.exam.paid).toBe(oddExamBefore - 100);
    expect(yrAfter.academic.odd.tuition.paid).toBe(oddTuitionBefore);
  });

  it("recalls last fee head in a breakdown â†’ breakdown removed, receipt persists with other breakdowns", async () => {
    // Make a payment across 2 semesters (2 breakdowns)
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: recallRollNo,
        paymentType: "UPI",
        breakdowns: [
          { academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 1, tuition: 200 } },
          { academicYear: testCtx.academicYearPrimary, academic: { semesterNumber: 2, tuition: 400 } },
        ],
      });
    expect(payRes.status).toBe(201);
    const multiReceiptNo = payRes.body.data;
    const txnRes = await request(app).get(`/api/feePayment/${recallRollNo}`).set(adminAuth());
    const multiReceipt = txnRes.body.data.transactions.find(t => t.receiptNo === multiReceiptNo);
    expect(multiReceipt.breakdowns).toHaveLength(2);

    // Recall the sole fee head of the first breakdown (sem1 tuition)
    const firstBdOnlyFeeHead = Object.values(multiReceipt.breakdowns[0].feeHeads)[0];
    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo: multiReceipt.receiptNo,
        rollNo: recallRollNo,
        reason: "Remove sem1 breakdown entirely",
        feeHeadIds: [firstBdOnlyFeeHead._id],
      });
    expect(recallRes.status).toBe(201);

    // Receipt still exists, but only the second breakdown remains
    const txnAfter = await StudentTransaction.findOne({ rollNo: recallRollNo });
    const receiptAfter = txnAfter.transactions.find(t => t.receiptNo === multiReceipt.receiptNo);
    expect(receiptAfter).toBeDefined();
    expect(receiptAfter.breakdowns).toHaveLength(1);
    expect(receiptAfter.breakdowns[0].semesterNumber).toBe(2);
  });

  it("restores enrollment.excessAmount when recalling excessAmount payment", async () => {
    const rollNo = `32CS${testCtx.TS.slice(-3)}`;
    const startingExcess = 2000;

    const stuRes = await createStudent(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      enrollment: {
        quota: "Government Quota",
        firstGraduate: { isApplicable: false },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
        excessAmount: startingExcess,
        isExcessAmountTrue: true,
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
        breakdowns: [
          {
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 1, tuition: 1000 },
          },
        ],
      });
    expect(payRes.status).toBe(201);
    const receiptNo = payRes.body.data;

    const txnRes = await request(app)
      .get(`/api/feePayment/${rollNo}`)
      .set(adminAuth());
    const receipt = txnRes.body.data.transactions.find(t => t.receiptNo === receiptNo);
    const feeHeadId = Object.values(receipt.breakdowns[0].feeHeads)[0]._id;

    const recallRes = await request(app)
      .post("/api/receiptRecall")
      .set(adminAuth())
      .send({
        receiptNo,
        rollNo,
        reason: "Restore excess after recall",
        feeHeadIds: [feeHeadId],
      });
    expect(recallRes.status).toBe(201);

    const updatedStudent = await Student.findOne({ "personal.rollNo": rollNo }).lean();
    expect(updatedStudent.enrollment.excessAmount).toBeCloseTo(startingExcess, 2);

    await Promise.all([
      ReceiptRecallRequest.deleteMany({ rollNo }),
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
  });

  /* â”€â”€â”€ LIST RECALLS â”€â”€â”€â”€â”€ */

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

