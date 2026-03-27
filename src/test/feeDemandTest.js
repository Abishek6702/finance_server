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
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .query({ academicYear: testCtx.academicYearPrimary });
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

  it("returns correct student summary fields", async () => {
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
    expect(record).not.toHaveProperty("fee");

    expect(record.studentType).toHaveProperty("transport", true);
    expect(record.studentType).toHaveProperty("hostel", true);
  });

  it("filters by academicYear", async () => {
    const res = await request(app)
      .get("/api/feedemands")
      .set(adminAuth())
      .query({ rollNo: feeDemandRollNo, academicYear: testCtx.academicYearPrimary });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const record = res.body.data[0];
    expect(record.student.rollNo).toBe(feeDemandRollNo);
    expect(record).not.toHaveProperty("fee");
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
     API 2: GET /feedemands/:rollNo?academicYear=YYYY-YYYY
  ───────────────────────────────────────────── */

  it("returns academic-year scoped fee demand shape", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .set(adminAuth())
      .query({ academicYear: testCtx.academicYearPrimary });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty("rollNo", feeDemandRollNo);
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("photo");
    expect(data).toHaveProperty("department");
    expect(data).toHaveProperty("section");
    expect(data).toHaveProperty("batch");
    expect(data).toHaveProperty("currentAcademicYear", testCtx.academicYearPrimary);

    expect(data.studentType).toHaveProperty("transport", true);
    expect(data.studentType).toHaveProperty("hostel", true);
    expect(data.studentType.hostelDetails).toBeDefined();
    expect(data.studentType.hostelDetails).toHaveProperty("hostel");
    expect(data.studentType.hostelDetails).toHaveProperty("block");
    expect(data.studentType.hostelDetails).toHaveProperty("sharing");
    expect(data.studentType.hostelDetails).toHaveProperty("isAttached");
    expect(data.studentType.hostelDetails).toHaveProperty("fee");
    expect(data.studentType.hostelDetails).toHaveProperty("paid");
    expect(data.studentType.hostelDetails).toHaveProperty("consession");
    expect(data.studentType.transportDetails).toBeDefined();
    expect(data.studentType.transportDetails).toHaveProperty("transport");
    expect(data.studentType.transportDetails).toHaveProperty("route");
    expect(data.studentType.transportDetails).toHaveProperty("busNo");
    expect(data.studentType.transportDetails).toHaveProperty("stop");
    expect(data.studentType.transportDetails).toHaveProperty("fee");
    expect(data.studentType.transportDetails).toHaveProperty("paid");
    expect(data.studentType.transportDetails).toHaveProperty("consession");
  });

  it("validates missing academicYear query", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .set(adminAuth());

    expect(res.status).toBe(400);
  });

  it("validates academicYear query format", async () => {
    const res = await request(app)
      .get(`/api/feedemands/${feeDemandRollNo}`)
      .set(adminAuth())
      .query({ academicYear: "2025/2026" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/feedemands/99ZZ999")
      .set(adminAuth())
      .query({ academicYear: testCtx.academicYearPrimary });

    expect(res.status).toBe(404);
  });

});
