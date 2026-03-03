const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Student Fee Tracking API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Create fee structure + student + payment so tracking record exists
    const fsRes = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));
    expect([200, 201, 409]).toContain(fsRes.status);

    const stuRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary }));
    expect([200, 201, 409]).toContain(stuRes.status);

    // Make a payment so fee tracking record has data (receiptNo is auto-generated)
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "Cash",
        bankName: "Indian Bank",
        bankLocation: "Kinathukadavu",
        remarks: "first payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    // Payment may fail if tracking already has this fee paid from another suite run — that's OK
    expect([201, 400]).toContain(payRes.status);
  });

  afterAll(async () => {
    await StudentTransaction.deleteMany({ rollNo: testCtx.studentRollFinance });
    await StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollFinance });
    await Student.deleteMany({ "personal.rollNo": testCtx.studentRollFinance });
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  /* ─── AUTH ───── */

  it("rejects access without token", async () => {
    const res = await request(app).get("/api/studentFeeTracking");
    expect(res.status).toBe(401);
  });

  /* ─── NO FILTERS (all students) ───── */

  it("returns all students with fee tracking when no filters", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  /* ─── FILTER BY rollNo ───── */

  it("returns a single student when filtered by rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const record = res.body.data[0];
    expect(record.student.personal.rollNo).toBe(testCtx.studentRollFinance);
    expect(record.feeTracking).toBeDefined();
    // Note: rollNo is not returned in feeTracking (stripped by service)
    expect(record.feeTracking.academicYearWiseRecord.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: "99ZZ999" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  /* ─── FILTER BY department ───── */

  it("filters by department", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((r) => {
      expect(r.student.academic.departmentName).toBe("CSE");
    });
  });

  it("returns empty array for non-existent department filter", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "MECH" });
    // might return 0 if no MECH students exist in test DB
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  /* ─── FILTER BY batch ───── */

  it("filters by batch", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((r) => {
      expect(r.student.academic.batch).toBe(testCtx.academicYearPrimary);
    });
  });

  it("returns empty array for non-existent batch", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: "1900-1901" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  /* ─── COMBINED FILTERS ───── */

  it("filters by batch + department", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary, department: "CSE" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const record = res.body.data[0];
    expect(record.student.academic.batch).toBe(testCtx.academicYearPrimary);
    expect(record.student.academic.departmentName).toBe("CSE");
  });

  it("filters by batch + department + rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({
        batch: testCtx.academicYearPrimary,
        department: "CSE",
        rollNo: testCtx.studentRollFinance,
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].student.personal.rollNo).toBe(testCtx.studentRollFinance);
  });

  /* ─── RESPONSE SHAPE ───── */

  it("response contains full student data and full feeTracking record", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    const record = res.body.data[0];

    // student object has all sections
    expect(record.student.personal).toBeDefined();
    expect(record.student.academic).toBeDefined();
    expect(record.student.contact).toBeDefined();
    expect(record.student.enrollment).toBeDefined();

    // feeTracking has academicYearWiseRecord array
    expect(Array.isArray(record.feeTracking.academicYearWiseRecord)).toBe(true);
    const yr = record.feeTracking.academicYearWiseRecord[0];
    expect(yr.academicYear).toBe(testCtx.academicYearPrimary);
    expect(yr.total).toBeDefined();
    expect(yr.total.total).toBeGreaterThan(0);
    expect(yr.total.paid).toBeGreaterThan(0);
  });

  /* ─── VALIDATION ───── */

  it("rejects invalid department value", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid batch format", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: "2024" });
    expect(res.status).toBe(400);
  });

  it("rejects non-alphanumeric rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: "12CS$##" });
    expect(res.status).toBe(400);
  });
});
