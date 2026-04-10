const {
  request,
  app,
  testCtx,
  createFeeStructure,
  createStudent,
  globalSetup,
  globalTeardown,
  adminAuth,
  Student,
  StudentFeeTracking,
} = require("./setup");

describe("Dashboard API", () => {
  const rollCseHostel = `31CS${testCtx.TS.slice(-3)}`;
  const rollCseDay = `32CS${testCtx.TS.slice(-3)}`;
  const rollEceTransport = `33EC${testCtx.TS.slice(-3)}`;

  beforeAll(async () => {
    await globalSetup();

    const feeRes = await createFeeStructure(testCtx.academicYearPrimary);
    expect([201, 409]).toContain(feeRes.status);

    const createOne = await createStudent(rollCseHostel, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
    });
    expect([201, 409]).toContain(createOne.status);

    const createTwo = await createStudent(rollCseDay, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: false },
      transport: { isApplicable: false },
    });
    expect([201, 409]).toContain(createTwo.status);

    const createThree = await createStudent(rollEceTransport, {
      academicYear: testCtx.academicYearPrimary,
      transport: { isApplicable: true },
      hostel: { isApplicable: false },
    });
    expect([201, 409]).toContain(createThree.status);

    await Student.updateOne(
      { "personal.rollNo": rollEceTransport },
      {
        $set: {
          "academic.departmentName": "ECE",
          "transport.isApplicable": true,
          "hostel.isApplicable": false,
        },
      }
    );

    await Student.updateOne(
      { "personal.rollNo": rollCseDay },
      {
        $set: {
          "transport.isApplicable": false,
          "hostel.isApplicable": false,
        },
      }
    );

    await Student.updateOne(
      { "personal.rollNo": rollCseHostel },
      {
        $set: {
          "transport.isApplicable": false,
          "hostel.isApplicable": true,
        },
      }
    );

    await StudentFeeTracking.updateOne(
      {
        rollNo: rollCseHostel,
        "academicYearWiseRecord.academicYear": testCtx.academicYearPrimary,
      },
      {
        $set: {
          "academicYearWiseRecord.$.total.status": "Paid",
        },
      }
    );
  });

  afterAll(async () => {
    await globalTeardown();
  });

  it("rejects students count without token", async () => {
    const res = await request(app).get("/api/dashboard/students-count");
    expect(res.status).toBe(401);
  });

  it("rejects students count when year query is missing", async () => {
    const res = await request(app)
      .get("/api/dashboard/students-count")
      .set(adminAuth());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/year is required/i);
  });

  it("returns students count summary for the year", async () => {
    const res = await request(app)
      .get("/api/dashboard/students-count")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalStudents).toBeGreaterThanOrEqual(3);
    expect(res.body.data.totalHostelers).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalDayscholars).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalTransporters).toBeGreaterThanOrEqual(1);
  });

  it("rejects department distribution with invalid dept", async () => {
    const res = await request(app)
      .get("/api/dashboard/department-distribution")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary, dept: "INVALID" });

    expect(res.status).toBe(400);
  });

  it("returns department distribution for CSE", async () => {
    const res = await request(app)
      .get("/api/dashboard/department-distribution")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary, dept: "CSE" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalMembers).toBeGreaterThanOrEqual(2);
    expect(res.body.data.Hostel).toBeGreaterThanOrEqual(1);
    expect(res.body.data.Dayscholar).toBeGreaterThanOrEqual(1);
    expect(res.body.data.Transport).toBeGreaterThanOrEqual(0);
  });

  it("returns department wise paid and unpaid summary", async () => {
    const res = await request(app)
      .get("/api/dashboard/fees-status")
      .set(adminAuth())
      .query({ year: testCtx.academicYearPrimary });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.year).toBe(testCtx.academicYearPrimary);
    expect(Array.isArray(res.body.data.departments)).toBe(true);

    const cse = res.body.data.departments.find((d) => d.dept === "CSE");
    const ece = res.body.data.departments.find((d) => d.dept === "ECE");

    expect(cse).toBeDefined();
    expect(cse.paid).toBeGreaterThanOrEqual(1);
    expect(cse.unpaid).toBeGreaterThanOrEqual(1);

    expect(ece).toBeDefined();
    expect(ece.unpaid).toBeGreaterThanOrEqual(1);
  });
});
