const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  FeeStructureMaster, StudentFeeTracking, Student,
} = require("./setup");

describe("Fee Structure API", () => {
  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    // Cleanup
    await FeeStructureMaster.deleteMany({
      academicYear: { $in: [testCtx.academicYearPrimary, testCtx.academicYearSecondary] },
    });
    await globalTeardown();
  });

  /* ─── CREATE ───────────────────────────────────────── */

  it("creates primary fee structure (201)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.academicYear).toBe(testCtx.academicYearPrimary);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.academicStructures).toHaveLength(1);
    expect(res.body.data.academicStructures[0].departments[0].semesters).toHaveLength(8);
  });

  it("creates secondary fee structure (201)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearSecondary));
    expect(res.status).toBe(201);
  });

  it("rejects duplicate academicYear (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects invalid academicYear format (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload("bad-year"));
    expect(res.status).toBe(400);
  });

  it("rejects missing academicYear (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send({ academicStructures: [] });
    expect(res.status).toBe(400);
  });

  it("rejects invalid quota in academicStructures (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.academicStructures[0].quota = "Invalid Quota";
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid educationType (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.academicStructures[0].educationType = "PhD";
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid degreeProgram (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.academicStructures[0].degreeProgram = "BSc";
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid departmentName (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.academicStructures[0].departments[0].departmentName = "PHYSICS";
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects department with wrong number of semesters (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.academicStructures[0].departments[0].semesters = payload.academicStructures[0].departments[0].semesters.slice(0, 5);
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects invalid hostel sharingType (400)", async () => {
    const payload = buildFeeStructurePayload(testCtx.academicYearMissing);
    payload.hostelStructures[0].roomType.sharingType = "Single";
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("rejects non-array academicStructures (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send({ academicYear: testCtx.academicYearMissing, academicStructures: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("rejects non-array hostelStructures (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send({ academicYear: testCtx.academicYearMissing, hostelStructures: "not-an-array" });
    expect(res.status).toBe(400);
  });

  /* ─── READ ─────────────────────────────────────────── */

  it("lists fee structures (200)", async () => {
    const res = await request(app).get("/api/feeStructureMaster").set(superadminAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("gets fee structure by year (200)", async () => {
    const res = await request(app)
      .get(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.academicYear).toBe(testCtx.academicYearPrimary);
    // Verify auto-calculated totals
    const dept = res.body.data.academicStructures[0].departments[0];
    expect(dept.total.fee).toBeGreaterThan(0);
    const semester1 = dept.semesters[0];
    expect(semester1.total.fee).toBe(
      semester1.tuition.fee + semester1.exam.fee + semester1.erp.fee + semester1.book.fee + semester1.lab.fee
    );
  });

  it("returns 404 for unknown year GET", async () => {
    const res = await request(app)
      .get(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
      .set(superadminAuth());
    expect(res.status).toBe(404);
  });

  /* ─── UPDATE ───────────────────────────────────────── */

  it("updates fee structure to inactive", async () => {
    const res = await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary, { isActive: false }));
    expect(res.status).toBe(200);
    expect(res.body.data.feeStructure.isActive).toBe(false);
  });

  it("reactivates fee structure", async () => {
    const res = await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary, { isActive: true }));
    expect(res.status).toBe(200);
    expect(res.body.data.feeStructure.isActive).toBe(true);
  });

  it("rejects update with invalid academicYear in payload (400)", async () => {
    const res = await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth())
      .send(buildFeeStructurePayload("bad-year"));
    expect(res.status).toBe(400);
  });

  it("returns 400 updating unknown year", async () => {
    const res = await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearMissing));
    expect(res.status).toBe(404);
  });

  /* ─── FEE STRUCTURE UPDATE PROPAGATION ──────────────── */

  it("propagates fee structure update to student tracking", async () => {
    // Create a student linked to primary fee structure
    const studentPayload = buildStudentPayload(testCtx.studentRollCrud, {
      academicYear: testCtx.academicYearPrimary,
    });
    const createRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(studentPayload);
    expect(createRes.status).toBe(201);

    // Check initial tracking fee totals
    const beforeTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollCrud });
    expect(beforeTracking).toBeTruthy();
    const beforeYear = beforeTracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    const beforeTuition = beforeYear.academic.odd.tuition.total;
    expect(beforeTuition).toBe(40000); // sem1 base tuition

    // Update fee structure: increase tuition from 40000 to 50000 for sem1
    const updatedPayload = buildFeeStructurePayload(testCtx.academicYearPrimary);
    updatedPayload.academicStructures[0].departments[0].semesters[0].tuition.fee = 50000;
    updatedPayload.academicStructures[0].departments[0].semesters[0].total.fee = 50000 + 2000 + 500 + 1000 + 1500;

    const updateRes = await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth())
      .send(updatedPayload);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.trackingRecordsUpdated).toBeGreaterThanOrEqual(1);

    // Verify tracking was updated
    const afterTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollCrud });
    const afterYear = afterTracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
    expect(afterYear.academic.odd.tuition.total).toBe(50000);

    // Restore original fee structure
    const restorePayload = buildFeeStructurePayload(testCtx.academicYearPrimary);
    await request(app)
      .put(`/api/feeStructureMaster/${testCtx.academicYearPrimary}`)
      .set(superadminAuth())
      .send(restorePayload);

    // Clean up student
    await request(app)
      .delete(`/api/studentsManagement/${testCtx.studentRollCrud}`)
      .set(superadminAuth());
  });

  /* ─── DELETE ───────────────────────────────────────── */

  it("returns 404 deleting unknown year", async () => {
    const res = await request(app)
      .delete(`/api/feeStructureMaster/${testCtx.academicYearMissing}`)
      .set(superadminAuth());
    expect(res.status).toBe(404);
  });

  it("deletes secondary fee structure", async () => {
    const res = await request(app)
      .delete(`/api/feeStructureMaster/${testCtx.academicYearSecondary}`)
      .set(superadminAuth());
    expect(res.status).toBe(200);
  });
});
