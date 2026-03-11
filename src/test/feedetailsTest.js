const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Details API", () => {
  beforeAll(async () => {
    await globalSetup();

    const fsRes = await createFeeStructure(testCtx.academicYearPrimary);
    expect([200, 201, 409]).toContain(fsRes.status);

    const stuRes = await createStudent(testCtx.studentRollFinance, {
      academicYear: testCtx.academicYearPrimary,
    });
    expect([200, 201, 409]).toContain(stuRes.status);

    // Record a payment so tracking has paid > 0
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 2000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    expect([201, 400]).toContain(payRes.status);
  });

  afterAll(async () => {
    await Promise.all([
      StudentTransaction.deleteMany({ rollNo: testCtx.studentRollFinance }),
      StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollFinance }),
      Student.deleteMany({ "personal.rollNo": testCtx.studentRollFinance }),
      FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary }),
    ]);
    await globalTeardown();
  });

  /* ─────────────────────────────────────────────
     AUTH
  ───────────────────────────────────────────── */

  it("GET /feedetails - rejects without token", async () => {
    const res = await request(app).get("/api/feedetails");
    expect(res.status).toBe(401);
  });

  it("GET /feedetails/:rollNo - rejects without token", async () => {
    const res = await request(app).get(`/api/feedetails/${testCtx.studentRollFinance}`);
    expect(res.status).toBe(401);
  });

  it("GET /feedetails/:rollNo/:academicYear - rejects without token", async () => {
    const res = await request(app).get(
      `/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`
    );
    expect(res.status).toBe(401);
  });

  /* ─────────────────────────────────────────────
     API 1: GET /feedetails
  ───────────────────────────────────────────── */

  it("returns list with correct shape", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.totalRecords).toBe("number");
  });

  it("returns correct student summary fields", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });

    expect(res.status).toBe(200);
    const record = res.body.data[0];

    expect(record.student.rollNo).toBe(testCtx.studentRollFinance);
    expect(record.student).toHaveProperty("name");
    expect(record.student).toHaveProperty("department");
    expect(record.student).toHaveProperty("year");

    expect(record.fee).toHaveProperty("demand");
    expect(record.fee).toHaveProperty("concession");
    expect(record.fee).toHaveProperty("paid");
    expect(record.fee).toHaveProperty("overdue");
    expect(record.fee).toHaveProperty("status");
    expect(typeof record.fee.demand).toBe("number");
    expect(typeof record.fee.overdue).toBe("number");

    expect(record.studentType).toHaveProperty("transport");
    expect(record.studentType).toHaveProperty("hostel");
  });

  it("filters by academicYear", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({
        rollNo: testCtx.studentRollFinance,
        academicYear: testCtx.academicYearPrimary,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty data for academicYear with no match", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({
        rollNo: testCtx.studentRollFinance,
        academicYear: testCtx.academicYearMissing,
      });

    expect(res.status).toBe(200);
    expect(res.body.data[0].fee.demand).toBe(0);
    expect(res.body.data[0].fee.paid).toBe(0);
  });

  it("returns empty array for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ rollNo: "99ZZ999" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalRecords).toBe(0);
  });

  it("validates department filter", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ department: "INVALID_DEPT" });

    expect(res.status).toBe(400);
  });

  it("validates batch format", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ batch: "2025/2029" });

    expect(res.status).toBe(400);
  });

  it("validates academicYear format", async () => {
    const res = await request(app)
      .get("/api/feedetails")
      .set(adminAuth())
      .query({ academicYear: "2025/2026" });

    expect(res.status).toBe(400);
  });

  /* ─────────────────────────────────────────────
     API 2: GET /feedetails/:rollNo
  ───────────────────────────────────────────── */

  it("returns year-wise summary with profile by default", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.student).toBeDefined();
    expect(data.student.rollNo).toBe(testCtx.studentRollFinance);
    expect(data.contact).toBeDefined();
    expect(data.contact.student).toBeDefined();
    expect(data.contact.father).toBeDefined();

    expect(Array.isArray(data.feeSummary)).toBe(true);
    expect(data.overall).toBeDefined();
    expect(data.overall).toHaveProperty("demand");
    expect(data.overall).toHaveProperty("paid");
    expect(data.overall).toHaveProperty("overdue");
    expect(data.overall).toHaveProperty("status");
    expect(data.overall).toHaveProperty("total");
  });

  it("excludes profile when includeProfile=false", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({ includeProfile: "false" });

    expect(res.status).toBe(200);
    expect(res.body.data.student).toBeUndefined();
    expect(res.body.data.contact).toBeUndefined();
    expect(Array.isArray(res.body.data.feeSummary)).toBe(true);
  });

  it("feeSummary entries include required fields", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    const summary = res.body.data.feeSummary;
    expect(summary.length).toBeGreaterThanOrEqual(1);

    const entry = summary[0];
    expect(entry).toHaveProperty("academicYear");
    expect(entry).toHaveProperty("community");
    expect(entry).toHaveProperty("demand");
    expect(entry).toHaveProperty("concession");
    expect(entry).toHaveProperty("paid");
    expect(entry).toHaveProperty("overdue");
    expect(entry).toHaveProperty("status");
    expect(entry).toHaveProperty("total");
    expect(entry.studentType).toHaveProperty("transport");
    expect(entry.studentType).toHaveProperty("hostel");
  });

  it("returns 404 for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/feedetails/99ZZ999")
      .set(adminAuth());

    expect(res.status).toBe(404);
  });

  it("validates includeProfile parameter", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}`)
      .set(adminAuth())
      .query({ includeProfile: "yes" });

    expect(res.status).toBe(400);
  });

  /* ─────────────────────────────────────────────
     API 3: GET /feedetails/:rollNo/:academicYear
  ───────────────────────────────────────────── */

  it("returns semester breakdown with both semesters by default", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.academicYear).toBe(testCtx.academicYearPrimary);
    expect(Array.isArray(data.semesters)).toBe(true);
    expect(data.semesters).toHaveLength(2);

    expect(data.student).toBeDefined();
    expect(data.contact).toBeDefined();
  });

  it("odd semester has correct shape", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    const odd = res.body.data.semesters.find((s) => s.semesterType === "Odd");
    expect(odd).toBeDefined();
    expect(odd.overall).toHaveProperty("demand");
    expect(odd.overall).toHaveProperty("concession");
    expect(odd.overall).toHaveProperty("paid");
    expect(odd.overall).toHaveProperty("overdue");
    expect(odd.overall).toHaveProperty("status");
    expect(odd.overall).toHaveProperty("total");
    expect(odd.overall.studentType).toHaveProperty("transport");
    expect(odd.overall.studentType).toHaveProperty("hostel");
    expect(Array.isArray(odd.feeHeads)).toBe(true);
  });

  it("fee heads include required fields", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    const odd = res.body.data.semesters.find((s) => s.semesterType === "Odd");
    expect(odd.feeHeads.length).toBeGreaterThanOrEqual(1);

    const head = odd.feeHeads[0];
    expect(head).toHaveProperty("name");
    expect(head).toHaveProperty("total");
    expect(head).toHaveProperty("concession");
    expect(head).toHaveProperty("paid");
    expect(head).toHaveProperty("overdue");
    expect(head).toHaveProperty("status");
  });

  it("filters to odd semester only", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .query({ semester: "odd" });

    expect(res.status).toBe(200);
    expect(res.body.data.semesters).toHaveLength(1);
    expect(res.body.data.semesters[0].semesterType).toBe("Odd");
  });

  it("filters to even semester only", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .query({ semester: "even" });

    expect(res.status).toBe(200);
    expect(res.body.data.semesters).toHaveLength(1);
    expect(res.body.data.semesters[0].semesterType).toBe("Even");
  });

  it("excludes profile when includeProfile=false", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .query({ includeProfile: "false" });

    expect(res.status).toBe(200);
    expect(res.body.data.student).toBeUndefined();
    expect(res.body.data.contact).toBeUndefined();
    expect(res.body.data.academicYear).toBe(testCtx.academicYearPrimary);
  });

  it("returns 404 for non-existent student", async () => {
    const res = await request(app)
      .get(`/api/feedetails/99ZZ999/${testCtx.academicYearPrimary}`)
      .set(adminAuth());

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent academic year", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearMissing}`)
      .set(adminAuth());

    expect(res.status).toBe(404);
  });

  it("validates semester parameter", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .query({ semester: "spring" });

    expect(res.status).toBe(400);
  });

  it("validates academicYear path param format", async () => {
    const res = await request(app)
      .get(`/api/feedetails/${testCtx.studentRollFinance}/bad-year`)
      .set(adminAuth());

    expect(res.status).toBe(400);
  });
});
