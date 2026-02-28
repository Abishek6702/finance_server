const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster, ActivityLog,
} = require("./setup");

describe("Student Fee Tracking API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Create fee structure + finance student + initial payment
    await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary }));
    // Make a payment so we have receipt data
    await request(app)
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
        }],
      });
  });

  afterAll(async () => {
    await StudentTransaction.deleteMany({ rollNo: testCtx.studentRollFinance });
    await StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollFinance });
    await Student.deleteMany({ "personal.rollNo": testCtx.studentRollFinance });
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await ActivityLog.deleteMany({ endpoint: { $regex: /studentFeeTracking/ } });
    await globalTeardown();
  });

  /* ─── SUMMARY ───── */

  it("rejects summary access without token", async () => {
    const res = await request(app).get("/api/studentFeeTracking/summary");
    expect(res.status).toBe(401);
  });

  it("gets year summary", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/summary")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);
    expect(res.body.data.aggregate).toBeDefined();
    expect(res.body.data.aggregate.totalCollection).toBeGreaterThan(0);
    expect(res.body.data.aggregate.totalDue).toBeGreaterThan(0);
  });

  it("gets year summary without year param (defaults)", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/summary")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.aggregate).toBeDefined();
  });

  it("summary records contain expected shape", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/summary")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);

    const record = res.body.data.records.find(r => r.rollNo === testCtx.studentRollFinance);
    expect(record).toBeDefined();
    expect(record.studentDetails.name).toBeDefined();
    expect(record.demand).toBeGreaterThan(0);
    expect(record.paid).toBeGreaterThan(0);
    expect(record.overdue).toBeGreaterThan(0);
    expect(record.status).toBe("Partially Paid");
    expect(record.studentType.isHosteler).toBe(false);
    expect(record.studentType.isDayScholar).toBe(true);
  });

  /* ─── STUDENT FEE SUMMARY ───── */

  it("gets student fee summary", async () => {
    const res = await request(app)
      .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.studentProfile.personal.rollNo).toBe(testCtx.studentRollFinance);
    expect(res.body.data.feeSummaryRecords.length).toBeGreaterThanOrEqual(1);

    const yr = res.body.data.feeSummaryRecords.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.demand).toBeGreaterThan(0);
    expect(yr.paid).toBeGreaterThan(0);
    expect(yr.status).toBe("Partially Paid");
  });

  it("returns 404 for unknown fee summary student", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/summary/94CS994")
      .set(adminAuth());
    expect(res.status).toBe(404);
  });

  /* ─── FILTER STUDENTS ───── */

  it("filters students by department and year", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/students")
      .set(adminAuth())
      .query({ department: "CSE", year: 1 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("filters students by name", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/students")
      .set(adminAuth())
      .query({ name: "Jest" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("filters students by department only", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/students")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns empty for name filter with no match", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/students")
      .set(adminAuth())
      .query({ name: "XyzNonExistent999" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  /* ─── RECEIPT UPDATE ───── */

  it("rejects receipt update with no fields", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects receipt update with invalid paymentType", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
      .set(adminAuth())
      .send({ paymentType: "WIRE" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown receipt update", async () => {
    const res = await request(app)
      .put("/api/studentFeeTracking/receipt/UNKNOWN-REC")
      .set(adminAuth())
      .send({ remarks: "x" });
    expect(res.status).toBe(404);
  });

  it("updates receipt paymentType and bankName", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
      .set(adminAuth())
      .send({ paymentType: "Card", bankName: "SBI", remarks: "updated" });
    expect(res.status).toBe(200);
    expect(res.body.data.paymentType).toBe("Card");
    expect(res.body.data.bankName).toBe("SBI");

    const log = await ActivityLog.findOne({ endpoint: `/api/studentFeeTracking/receipt/${testCtx.receiptOne}` });
    expect(log).toBeTruthy();
    expect(log.before.paymentType).toBe("Cash");
    expect(log.after.paymentType).toBe("Card");
  });

  it("updates receipt remarks only", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
      .set(adminAuth())
      .send({ remarks: "final remarks" });
    expect(res.status).toBe(200);
    expect(res.body.data.remarks).toBe("final remarks");
  });

  it("updates receipt bankLocation", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/receipt/${testCtx.receiptOne}`)
      .set(adminAuth())
      .send({ bankLocation: "Chennai" });
    expect(res.status).toBe(200);
    expect(res.body.data.bankLocation).toBe("Chennai");
  });

  /* ─── CONCESSION UPDATE ───── */

  it("rejects concession update when concessions missing", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects concession update with invalid precision (3 decimal places)", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 100.257 } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown student concession update", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/93CS993/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 100 } });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown academic year concession", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearMissing}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 100 } });
    expect(res.status).toBe(404);
  });

  it("updates concession successfully with all fields", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 1000, scheme7point5: 500, pmss: 250, sakthi: 250 } });
    expect(res.status).toBe(200);
    expect(res.body.data.totalConcession).toBe(2000);
    expect(res.body.data.firstGraduate).toBe(1000);
    expect(res.body.data.scheme7point5).toBe(500);
    expect(res.body.data.pmss).toBe(250);
    expect(res.body.data.sakthi).toBe(250);
  });

  it("updates concession with partial fields (only firstGraduate)", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 2000 } });
    expect(res.status).toBe(200);
    expect(res.body.data.firstGraduate).toBe(2000);
  });

  it("updates concession with decimal values (2 decimal)", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: 1500.50 } });
    expect(res.status).toBe(200);
    expect(res.body.data.firstGraduate).toBe(1500.5);
  });

  it("rejects concession with negative value", async () => {
    const res = await request(app)
      .put(`/api/studentFeeTracking/concession/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .send({ concessions: { firstGraduate: -100 } });
    expect(res.status).toBe(400);
  });
});
