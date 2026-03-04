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

  it("rejects non-array academicStructures (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send({ academicYear: testCtx.academicYearMissing, academicStructures: "not-an-array" });
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

/* ─── BULK UPSERT ───────────────────────────────────────── */

describe("Fee Structure Bulk Upsert API", () => {
  // Derive isolated years from testCtx.academicYearMissing (offset by +40/+41)
  const [missStart, missEnd] = testCtx.academicYearMissing.split("-").map(Number);
  const bulkYear1 = `${missStart + 40}-${missEnd + 40}`;
  const bulkYear2 = `${missStart + 41}-${missEnd + 41}`;

  const BULK_HEADER = "academicYear,quota,educationType,degreeProgram,departmentName,semesterNumber,tuition,exam,erp,book,lab,isActive";

  const buildFeeCSV = (rows) => {
    const lines = [BULK_HEADER, ...rows.map((r) => Object.values(r).join(","))];
    return Buffer.from(lines.join("\n"), "utf-8");
  };

  const buildAllSemsRows = (academicYear, quota) =>
    Array.from({ length: 8 }, (_, i) => ({
      academicYear, quota, educationType: "UG", degreeProgram: "BE",
      departmentName: "CSE", semesterNumber: i + 1,
      tuition: 40000, exam: 2000, erp: 500, book: 1000, lab: 1500, isActive: "true",
    }));

  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    await FeeStructureMaster.deleteMany({ academicYear: { $in: [bulkYear1, bulkYear2] } });
    await globalTeardown();
  });

  it("rejects bulk upsert without file (400)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth());
    expect(res.status).toBe(400);
  });

  it("rejects bulk upsert with empty CSV (400)", async () => {
    const emptyCSV = Buffer.from(`${BULK_HEADER}\n`, "utf-8");
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", emptyCSV, "empty.csv");
    expect(res.status).toBe(400);
  });

  it("rejects bulk upsert for admin role (401)", async () => {
    const csvBuf = buildFeeCSV(buildAllSemsRows(bulkYear1, "Government Quota"));
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(adminAuth())
      .attach("file", csvBuf, "fees.csv");
    expect(res.status).toBe(401);
  });

  it("bulk creates fee structures for two new academic years (200)", async () => {
    const rows = [
      ...buildAllSemsRows(bulkYear1, "Government Quota"),
      ...buildAllSemsRows(bulkYear1, "Management Quota"),
      ...buildAllSemsRows(bulkYear2, "Government Quota"),
    ];
    const csvBuf = buildFeeCSV(rows);
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "fees.csv");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toContain(bulkYear1);
    expect(res.body.data.created).toContain(bulkYear2);
    expect(res.body.data.updated).toHaveLength(0);
    expect(res.body.data.rowErrors).toHaveLength(0);

    const doc = await FeeStructureMaster.findOne({ academicYear: bulkYear1 });
    expect(doc).toBeTruthy();
    expect(doc.academicStructures).toHaveLength(2); // govt + mgmt
    const govtStruct = doc.academicStructures.find((a) => a.quota === "Government Quota");
    const cseDept = govtStruct.departments.find((d) => d.departmentName === "CSE");
    expect(cseDept.semesters).toHaveLength(8);
    expect(cseDept.semesters[0].tuition.fee).toBe(40000);
    expect(cseDept.total.fee).toBeGreaterThan(0);
  });

  it("bulk updates existing year – overrides specific semester only (200)", async () => {
    // Only send sem 1 with new tuition = 55000; all other sems should retain 40000
    const rows = [{
      academicYear: bulkYear1, quota: "Government Quota", educationType: "UG",
      degreeProgram: "BE", departmentName: "CSE", semesterNumber: 1,
      tuition: 55000, exam: 2000, erp: 500, book: 1000, lab: 1500, isActive: "true",
    }];
    const csvBuf = buildFeeCSV(rows);
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "fees.csv");

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toContain(bulkYear1);
    expect(res.body.data.created).toHaveLength(0);

    const doc = await FeeStructureMaster.findOne({ academicYear: bulkYear1 });
    const govtStruct = doc.academicStructures.find((a) => a.quota === "Government Quota");
    const cseDept = govtStruct.departments.find((d) => d.departmentName === "CSE");
    expect(cseDept.semesters.find((s) => s.semesterNumber === 1).tuition.fee).toBe(55000);
    expect(cseDept.semesters.find((s) => s.semesterNumber === 2).tuition.fee).toBe(40000);
  });

  it("returns 207 when some rows have an invalid quota (row-level error)", async () => {
    const rows = [
      {
        academicYear: bulkYear2, quota: "Unknown Quota", educationType: "UG",
        degreeProgram: "BE", departmentName: "CSE", semesterNumber: 1,
        tuition: 40000, exam: 2000, erp: 500, book: 1000, lab: 1500, isActive: "true",
      },
      // Valid rows so we don't hit the "no valid rows" 400
      ...buildAllSemsRows(bulkYear2, "Government Quota"),
    ];
    const csvBuf = buildFeeCSV(rows);
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "fees.csv");

    expect(res.status).toBe(207);
    expect(res.body.success).toBe(false);
    expect(res.body.data.rowErrors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.rowErrors[0].error).toMatch(/invalid quota/i);
  });

  it("returns 400 when no valid rows remain after row-level validation", async () => {
    const rows = [{
      academicYear: "bad-year", quota: "Government Quota", educationType: "UG",
      degreeProgram: "BE", departmentName: "CSE", semesterNumber: 1,
      tuition: 40000, exam: 2000, erp: 500, book: 1000, lab: 1500, isActive: "true",
    }];
    const csvBuf = buildFeeCSV(rows);
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "fees.csv");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no valid rows/i);
  });

  it("skips rows with empty quota without error (not-applicable signal)", async () => {
    const rows = [
      // Row with empty quota – should be silently skipped
      {
        academicYear: bulkYear1, quota: "", educationType: "UG",
        degreeProgram: "BE", departmentName: "CSE", semesterNumber: 1,
        tuition: 40000, exam: 2000, erp: 500, book: 1000, lab: 1500, isActive: "true",
      },
      // At least one valid row
      ...buildAllSemsRows(bulkYear1, "Management Quota"),
    ];
    const csvBuf = buildFeeCSV(rows);
    const res = await request(app)
      .post("/api/feeStructureMaster/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "fees.csv");

    expect(res.status).toBe(200);
    expect(res.body.data.rowErrors).toHaveLength(0); // silent skip, NOT a rowError
  });
});
