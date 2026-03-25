const {
  request, app, testCtx,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Fee Demand API", () => {
  const feeDemandRollNo = `40CS${testCtx.TS.slice(-3)}`;

  beforeAll(async () => {
    await globalSetup();

    const fsRes = await createFeeStructure(testCtx.academicYearPrimary);
    expect([200, 201, 409]).toContain(fsRes.status);

    const stuRes = await createStudent(feeDemandRollNo, {
      academicYear: testCtx.academicYearPrimary,
      transport: {
        isApplicable: true,
        transport: "College Bus",
        route: "Route A",
        busNo: "BUS-12",
        stop: "Main Stop",
        fee: 12000,
      },
      hostel: {
        isApplicable: true,
        hostel: "College Hostel",
        block: "A",
        sharing: 3,
        isAttached: true,
        fee: 25000,
      },
    });
    expect([200, 201, 409]).toContain(stuRes.status);
  });

  afterAll(async () => {
    await Promise.all([
      StudentTransaction.deleteMany({ rollNo: feeDemandRollNo }),
      StudentFeeTracking.deleteMany({ rollNo: feeDemandRollNo }),
      Student.deleteMany({ "personal.rollNo": feeDemandRollNo }),
      FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary }),
    ]);
    await globalTeardown();
  });

  /* ─────────────────────────────────────────────
     AUTH
  ───────────────────────────────────────────── */

  it("GET /feedemands - rejects without token", async () => {
    const res = await request(app).get("/api/feedemands");
    expect(res.status).toBe(401);
  });

  it("GET /feedemands/:rollNo - rejects without token", async () => {
    const res = await request(app).get(`/api/feedemands/${feeDemandRollNo}`);
    expect(res.status).toBe(401);
  });

  it("GET /feedemands/:rollNo/:academicYear - rejects without token", async () => {
    const res = await request(app).get(
      `/api/feedemands/${feeDemandRollNo}/${testCtx.academicYearPrimary}`
    );
    expect(res.status).toBe(401);
  });

  /* ─────────────────────────────────────────────
     API 1: GET /feedemands
  ───────────────────────────────────────────── */

  it("returns list with correct shape", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ rollNo: feeDemandRollNo });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.totalRecords).toBe("number");
  });

  it("returns correct student and fee summary fields", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ rollNo: feeDemandRollNo });

    expect(res.status).toBe(200);
    const record = res.body.data.find((row) => row.student.rollNo === feeDemandRollNo);

    expect(record).toBeDefined();
    expect(record.student).toHaveProperty("name");
    expect(record.student).toHaveProperty("department");
    expect(record.student).toHaveProperty("year");
    expect(record.student).toHaveProperty("currentAcademicYear", testCtx.academicYearPrimary);

    expect(record.fee).toHaveProperty("demand");
    expect(record.fee).toHaveProperty("academicYear");
    expect(record.fee).toHaveProperty("academicYears");
    expect(Array.isArray(record.fee.academicYears)).toBe(true);
    expect(record.fee).toHaveProperty("concession");
    expect(record.fee).toHaveProperty("paid");
    expect(record.fee).toHaveProperty("overdue");
    expect(record.fee).toHaveProperty("status");

    expect(record.studentType).toHaveProperty("transport", true);
    expect(record.studentType).toHaveProperty("hostel", true);
    expect(record.studentType.transportDetails).toBeDefined();
    expect(record.studentType.hostelDetails).toBeDefined();
  });

  it("filters by academicYear", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ rollNo: feeDemandRollNo, academicYear: testCtx.academicYearPrimary });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const record = res.body.data[0];
    expect(record.fee.academicYear).toBe(testCtx.academicYearPrimary);
    expect(record.fee.academicYears).toEqual([testCtx.academicYearPrimary]);
  });

  it("returns empty array for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ rollNo: "99ZZ999" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalRecords).toBe(0);
  });

  it("validates department filter", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ department: "INVALID_DEPT" });

    expect(res.status).toBe(400);
  });

  it("validates batch format", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ batch: "2025/2029" });

    expect(res.status).toBe(400);
  });

  it("validates academicYear format", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ academicYear: "2025/2026" });

    expect(res.status).toBe(400);
  });

  it("validates studyingYear", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ studyingYear: "5" });

    expect(res.status).toBe(400);
  });

  /* ─────────────────────────────────────────────
     API 2: GET /feedemands/:rollNo
  ───────────────────────────────────────────── */

  it("returns year-wise summary with profile by default", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.studentCurrentAcademicYear).toBe(testCtx.academicYearPrimary);
    expect(Array.isArray(data.feeAcademicYears)).toBe(true);
    expect(data.feeAcademicYears).toContain(testCtx.academicYearPrimary);
    expect(data.student).toBeDefined();
    expect(data.student.rollNo).toBe(feeDemandRollNo);
    expect(data.contact).toBeDefined();

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
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .set(adminAuth())
      .query({ includeProfile: "false" });

    expect(res.status).toBe(200);
    expect(res.body.data.student).toBeUndefined();
    expect(res.body.data.contact).toBeUndefined();
  });

  it("feeSummary entries include studentType details", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
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
    expect(entry.studentType).toHaveProperty("transport", true);
    expect(entry.studentType).toHaveProperty("hostel", true);
    expect(entry.studentType.transportDetails).toBeDefined();
    expect(entry.studentType.hostelDetails).toBeDefined();
  });

  it("returns 404 for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/feedemands/99ZZ999")
      .set(adminAuth());

    expect(res.status).toBe(404);
  });

  /* ─────────────────────────────────────────────
     API 3: GET /feedemands/:rollNo/:academicYear
  ───────────────────────────────────────────── */

  it("returns semester breakdown", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}/${testCtx.academicYearPrimary}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentCurrentAcademicYear).toBe(testCtx.academicYearPrimary);
    expect(res.body.data.feeAcademicYear).toBe(testCtx.academicYearPrimary);
    expect(Array.isArray(res.body.data.semesters)).toBe(true);
    expect(res.body.data.semesters.length).toBeGreaterThanOrEqual(1);

    const overall = res.body.data.semesters[0].overall;
    expect(overall.studentType).toHaveProperty("transport", true);
    expect(overall.studentType).toHaveProperty("hostel", true);
    expect(overall.studentType.transportDetails).toBeDefined();
    expect(overall.studentType.hostelDetails).toBeDefined();
  });

  it("validates semester filter", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}/${testCtx.academicYearPrimary}`)
      .set(adminAuth())
      .query({ semester: "invalid" });

    expect(res.status).toBe(400);
  });
});
