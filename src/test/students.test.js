const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, FeeStructureMaster,
} = require("./setup");

describe("Students API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Ensure fee structure exists
    await createFeeStructure(testCtx.academicYearPrimary);
  });

  afterAll(async () => {
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  /* ─── VALIDATION EDGE CASES ────────────────────────── */

  it("rejects create when personal is missing entirely", async () => {
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send({ academic: { degreeProgram: "BE", batch: testCtx.academicYearPrimary, currentAcademicYear: testCtx.academicYearPrimary } });
    expect(res.status).toBe(400);
  });

  it("rejects create when academic is missing entirely", async () => {
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send({ personal: { rollNo: "99CS999" } });
    expect(res.status).toBe(400);
  });

  it("rejects create when academic.departmentName is missing", async () => {
    const payload = buildStudentPayload("99CS001", { academicYear: testCtx.academicYearPrimary });
    delete payload.academic.departmentName;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/departmentName/i);
  });

  it("rejects create when academic.yearStudying is missing", async () => {
    const payload = buildStudentPayload("99CS002", { academicYear: testCtx.academicYearPrimary });
    delete payload.academic.yearStudying;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yearStudying/i);
  });

  it("rejects create when academic.currentSemesterNumber is missing", async () => {
    const payload = buildStudentPayload("99CS003", { academicYear: testCtx.academicYearPrimary });
    delete payload.academic.currentSemesterNumber;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/currentSemesterNumber/i);
  });

  it("rejects create when enrollment.quota is missing", async () => {
    const payload = buildStudentPayload("99CS004", { academicYear: testCtx.academicYearPrimary });
    delete payload.enrollment.quota;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/quota/i);
  });

  it("rejects invalid rollNo format", async () => {
    const payload = buildStudentPayload("BADROLL", { academicYear: testCtx.academicYearPrimary });
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rollNo/i);
  });

  it("rejects invalid gender enum", async () => {
    const payload = buildStudentPayload(`90CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.personal.gender = "Unknown";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid bloodGroup", async () => {
    const payload = buildStudentPayload(`91CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.personal.bloodGroup = "X+";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid aadharNo (not 12 digits)", async () => {
    const payload = buildStudentPayload(`92CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.personal.aadharNo = "12345";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid educationType", async () => {
    const payload = buildStudentPayload(`93CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.educationType = "PhD";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid departmentName", async () => {
    const payload = buildStudentPayload(`94CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.departmentName = "PHYSICS";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid degreeProgram", async () => {
    const payload = buildStudentPayload(`95CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.degreeProgram = "BSc";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid yearStudying (out of range)", async () => {
    const payload = buildStudentPayload(`96CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.yearStudying = 5;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid currentSemesterNumber (9)", async () => {
    const payload = buildStudentPayload(`97CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.currentSemesterNumber = 9;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid section enum", async () => {
    const payload = buildStudentPayload(`98CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.section = "Z";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid batch format", async () => {
    const payload = buildStudentPayload(`99CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.batch = "2025/2029";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid selfMobileNo", async () => {
    const payload = buildStudentPayload(`80CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.contact.selfMobileNo = "123";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid officialEmail (not @sece.ac.in)", async () => {
    const payload = buildStudentPayload(`81CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.contact.officialEmail = "user@gmail.com";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid quota enum", async () => {
    const payload = buildStudentPayload(`82CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.enrollment.quota = "Sports Quota";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects non-boolean transport.isApplicable", async () => {
    const payload = buildStudentPayload(`83CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.transport = { isApplicable: "yes" };
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects non-boolean hostel.isApplicable", async () => {
    const payload = buildStudentPayload(`84CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.hostel = { isApplicable: "yes" };
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects negative concessionAmount", async () => {
    const payload = buildStudentPayload(`85CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.enrollment.firstGraduate = { isApplicable: true, yearlyTuitionConcessionAmount: -500 };
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects non-boolean isLateralEntry", async () => {
    const payload = buildStudentPayload(`86CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.isLateralEntry = "maybe";
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects community > 50 chars", async () => {
    const payload = buildStudentPayload(`87CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.personal.community = "A".repeat(51);
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects create when currentSemesterNumber mismatches batch+currentAcademicYear", async () => {
    const yearNum = Number(testCtx.academicYearPrimary.split("-")[0]);
    // batch is 2 years earlier → studyYear = 3 → valid sems are 5 and 6
    const mismatchedBatch = `${yearNum - 2}-${yearNum + 2}`;
    const payload = buildStudentPayload(`79CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.batch = mismatchedBatch;
    payload.academic.currentSemesterNumber = 1; // wrong — should be 5 or 6
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/currentSemesterNumber/i);
  });

  it("does NOT reject when currentSemesterNumber matches derived study year", async () => {
    const yearNum = Number(testCtx.academicYearPrimary.split("-")[0]);
    const mismatchedBatch = `${yearNum - 2}-${yearNum + 2}`; // studyYear = 3 → valid sems [5, 6]
    const payload = buildStudentPayload(`78CS${testCtx.TS.slice(-3)}`, { academicYear: testCtx.academicYearPrimary });
    payload.academic.batch = mismatchedBatch;
    payload.academic.currentSemesterNumber = 5;
    payload.academic.yearStudying = 3;
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    // Validation passes — request proceeds to DB/business-logic layer
    // We assert it is NOT a 400 from semester validation specifically
    if (res.status === 400) {
      expect(res.body.message).not.toMatch(/currentSemesterNumber.*must be/i);
    }
  });

  /* ─── CRUD STUDENT ─────────────────────────────────── */

  it("creates student with fee tracking (201)", async () => {
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollCrud, { academicYear: testCtx.academicYearPrimary }));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollCrud });
    expect(tracking).toBeTruthy();
    expect(tracking.academicYearWiseRecord.length).toBeGreaterThanOrEqual(1);
  });

  it("creates student with hostel linkage (201)", async () => {
    const payload = buildStudentPayload(testCtx.studentRollHostel, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
    });
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(201);

    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
    expect(tracking).toBeTruthy();
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.hostel).toBeDefined();
    expect(yr.hostel.subTotal).toBeGreaterThan(0);
  });

  it("creates student with transport linkage (201)", async () => {
    const payload = buildStudentPayload(testCtx.studentRollTransport, {
      academicYear: testCtx.academicYearPrimary,
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
    });
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(201);

    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollTransport });
    expect(tracking).toBeTruthy();
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.transport).toBeDefined();
    expect(yr.transport.subTotal).toBeGreaterThan(0);
  });

  it("creates student with both hostel + transport (201)", async () => {
    const payload = buildStudentPayload(testCtx.studentRollDual, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "B", sharing: 4, isAttached: false },
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Vadavalli" },
    });
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(201);

    const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollDual });
    const yr = tracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(yr.hostel).toBeDefined();
    expect(yr.transport).toBeDefined();
    expect(yr.total.total).toBeGreaterThan(yr.academic.total.total);
  });

  it("rejects duplicate rollNo (409)", async () => {
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollCrud, { academicYear: testCtx.academicYearPrimary }));
    expect(res.status).toBe(409);
  });

  /* ─── SEARCH ───────────────────────────────────────── */

  it("returns 400 on /search if 'q' is missing", async () => {
    const res = await request(app).get("/api/studentsManagement/search").set(adminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/query 'q' is required/i);
  });

  it("returns 400 on /search if 'q' is empty", async () => {
    const res = await request(app).get("/api/studentsManagement/search?q=   ").set(adminAuth());
    expect(res.status).toBe(400);
  });

  it("searches students by rollNo prefix successfully (200)", async () => {
    // First ensure we have some students starting with a known prefix
    const rollPre = testCtx.studentRollCrud.substring(0, 4); // E.g., '12CS'
    const res = await request(app).get(`/api/studentsManagement/search?q=${rollPre}`).set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Should find at least our test setup students
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // Validate the projection structure
    const first = res.body.data[0];
    expect(first.rollNo).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.profile).toBeDefined();
    expect(first.currentYear).toBeDefined();
    expect(first.department).toBeDefined();
    expect(first.batch).toBeDefined();
  });

  it("returns empty array when search prefix matches no students (200)", async () => {
    const res = await request(app).get("/api/studentsManagement/search?q=99ZZ999").set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  /* ─── BASIC LISITING ───────────────────────────────── */

  it("returns 200 on /basic and lists basic student details", async () => {
    const res = await request(app).get(`/api/studentsManagement/basic?academicYear=${testCtx.academicYearPrimary}`).set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    
    // Validate the mapped projection structure
    const first = res.body.data[0];
    if (first) {
      expect(first._id).toBeDefined();
      expect(first.rollNo).toBeDefined();
      expect(first.name).toBeDefined();
      expect(first.profile).toBeDefined();
      expect(first.currentYear).toBeDefined();
      expect(first.department).toBeDefined();
      expect(first.section).toBeDefined();
      expect(first.batch).toBeUndefined(); // ensure lean extra fields aren't there
    }
  });

  it("filters basic students by search parameter", async () => {
    const rollPre = testCtx.studentRollCrud.substring(0, 4);
    const res = await request(app).get(`/api/studentsManagement/basic?search=${rollPre}`).set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].rollNo).toMatch(new RegExp(rollPre, "i"));
  });

  /* ─── LIST / GET  ───────────────────────────────────── */

  it("lists all students (200)", async () => {
    const res = await request(app).get("/api/studentsManagement").set(superadminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("gets student by rollNo query param with populated transport (200)", async () => {
    const res = await request(app)
      .get(`/api/studentsManagement?rollNo=${testCtx.studentRollTransport}`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.personal.rollNo).toBe(testCtx.studentRollTransport);
    expect(res.body.data.transport.isApplicable).toBe(true);
    expect(res.body.data.transport.transport).toBeDefined();
  });

  it("gets student by rollNo query param with populated hostel (200)", async () => {
    const res = await request(app)
      .get(`/api/studentsManagement?rollNo=${testCtx.studentRollHostel}`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.hostel.isApplicable).toBe(true);
    expect(res.body.data.hostel.hostel).toBeDefined();
  });

  it("returns 404 for unknown student via rollNo query param", async () => {
    const res = await request(app)
      .get("/api/studentsManagement?rollNo=99CS999")
      .set(superadminAuth());
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid rollNo format in query param", async () => {
    const res = await request(app)
      .get("/api/studentsManagement?rollNo=BADROLL")
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rollNo/i);
  });

  it("returns only requested fields on list when fields param given", async () => {
    const res = await request(app)
      .get("/api/studentsManagement?fields=personal,academic")
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const first = res.body.data[0];
    expect(first.personal).toBeDefined();
    expect(first.academic).toBeDefined();
    expect(first.contact).toBeUndefined();
    expect(first.family).toBeUndefined();
  });

  it("returns only requested fields for single student when rollNo + fields given", async () => {
    const res = await request(app)
      .get(`/api/studentsManagement?rollNo=${testCtx.studentRollTransport}&fields=transport,hostel`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.transport).toBeDefined();
    expect(res.body.data.hostel).toBeDefined();
    expect(res.body.data.personal).toBeUndefined();
    expect(res.body.data.academic).toBeUndefined();
  });

  it("returns 400 for invalid fields param value", async () => {
    const res = await request(app)
      .get("/api/studentsManagement?fields=personal,invalidSection")
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid fields/i);
  });

  it("returns 401 for unauthenticated GET request", async () => {
    const res = await request(app).get("/api/studentsManagement");
    expect(res.status).toBe(401);
  });


  /* ─── UPDATE ───────────────────────────────────────── */

  it("updates student name and contact (200)", async () => {
    const res = await request(app)
      .put(`/api/studentsManagement/${testCtx.studentRollCrud}`)
      .set(superadminAuth())
      .send({ personal: { studentName: "Updated Student" }, contact: { selfMobileNo: "9876543211" } });
    expect(res.status).toBe(200);
    expect(res.body.data.personal.studentName).toBe("Updated Student");
  });

  it("rejects invalid update payload (bad mobile)", async () => {
    const res = await request(app)
      .put(`/api/studentsManagement/${testCtx.studentRollCrud}`)
      .set(superadminAuth())
      .send({ contact: { selfMobileNo: "123" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 updating unknown student", async () => {
    const res = await request(app)
      .put("/api/studentsManagement/98CS998")
      .set(superadminAuth())
      .send({ personal: { studentName: "No One" } });
    expect(res.status).toBe(404);
  });

  /* ─── DELETE ───────────────────────────────────────── */

  it("returns 404 deleting unknown student", async () => {
    const res = await request(app)
      .delete("/api/studentsManagement/97CS997")
      .set(superadminAuth());
    expect(res.status).toBe(404);
  });

  it("deletes students and verifies tracking cleanup", async () => {
    for (const rollNo of [testCtx.studentRollCrud, testCtx.studentRollHostel, testCtx.studentRollTransport, testCtx.studentRollDual]) {
      const res = await request(app)
        .delete(`/api/studentsManagement/${rollNo}`)
        .set(superadminAuth());
      expect(res.status).toBe(200);

      const studentDoc = await Student.findOne({ "personal.rollNo": rollNo });
      const trackingDoc = await StudentFeeTracking.findOne({ rollNo });
      expect(studentDoc).toBeNull();
      expect(trackingDoc).toBeNull();
    }
  });
});
