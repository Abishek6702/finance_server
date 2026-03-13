const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  FeeStructureMaster, StudentFeeTracking, Student, Transport, Hostel,
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

  it("creates tracking row using academicYear+department+educationType+degreeProgram key even if quota differs", async () => {
    const rollNo = `55CS${testCtx.TS.slice(-3)}`;
    const payload = buildStudentPayload(rollNo, {
      academicYear: testCtx.academicYearPrimary,
      enrollment: {
        quota: "Management Quota",
        firstGraduate: { isApplicable: false },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
      },
    });

    const createStudentRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(payload);
    expect(createStudentRes.status).toBe(201);

    const tracking = await StudentFeeTracking.findOne({ rollNo });
    expect(tracking).toBeTruthy();

    const row = tracking.academicYearWiseRecord.find(
      (record) => record.academicYear === testCtx.academicYearPrimary
    );
    expect(row).toBeTruthy();
    expect(row.academic.total.total).toBeGreaterThan(0);

    const deleteStudentRes = await request(app)
      .delete(`/api/studentsManagement/${rollNo}`)
      .set(superadminAuth());
    expect(deleteStudentRes.status).toBe(200);
  });

  it("appends a new tracking row when creating fee structure for students in same current academic year", async () => {
    const appendStartYear = parseInt(testCtx.academicYearSecondary.split("-")[0], 10) + 5;
    const appendAcademicYear = `${appendStartYear}-${appendStartYear + 1}`;

    const [transportDoc, hostelDoc] = await Promise.all([
      Transport.findOne({}),
      Hostel.findOne({}),
    ]);

    expect(transportDoc).toBeTruthy();
    expect(hostelDoc).toBeTruthy();

    const createStudentRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollDual, {
        academicYear: testCtx.academicYearPrimary,
        transport: {
          isApplicable: true,
          route: transportDoc.route,
          stopName: transportDoc.stop,
        },
        hostel: {
          isApplicable: true,
          block: hostelDoc.block,
          sharing: hostelDoc.sharing,
          isAttached: hostelDoc.isAttached,
        },
      }));

    expect(createStudentRes.status).toBe(201);

    const beforeTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollDual });
    expect(beforeTracking).toBeTruthy();
    expect(beforeTracking.academicYearWiseRecord.length).toBe(1);

    const beforePrimaryRow = beforeTracking.academicYearWiseRecord.find(
      (row) => row.academicYear === testCtx.academicYearPrimary
    );
    expect(beforePrimaryRow).toBeTruthy();
    const beforePrimaryOddTuition = beforePrimaryRow.academic.odd.tuition.total;

    await Student.updateOne(
      { "personal.rollNo": testCtx.studentRollDual },
      {
        $set: {
          "academic.batch": appendAcademicYear,
          "academic.currentAcademicYear": appendAcademicYear,
        },
      }
    );

    const createNewYearStructureRes = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(appendAcademicYear));

    expect(createNewYearStructureRes.status).toBe(201);

    const afterTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollDual });
    expect(afterTracking).toBeTruthy();
    expect(afterTracking.academicYearWiseRecord.length).toBe(2);

    const afterPrimaryRow = afterTracking.academicYearWiseRecord.find(
      (row) => row.academicYear === testCtx.academicYearPrimary
    );
    expect(afterPrimaryRow).toBeTruthy();
    expect(afterPrimaryRow.academic.odd.tuition.total).toBe(beforePrimaryOddTuition);

    const appendedRow = afterTracking.academicYearWiseRecord.find(
      (row) => row.academicYear === appendAcademicYear
    );
    expect(appendedRow).toBeTruthy();
    expect(appendedRow.transport.fee).toBe(transportDoc.fee);
    expect(String(appendedRow.transport.transport)).toBe(String(transportDoc._id));
    expect(appendedRow.hostel.fee).toBe(hostelDoc.fee);
    expect(String(appendedRow.hostel.hostel)).toBe(String(hostelDoc._id));

    const deleteStudentRes = await request(app)
      .delete(`/api/studentsManagement/${testCtx.studentRollDual}`)
      .set(superadminAuth());
    expect(deleteStudentRes.status).toBe(200);

    const deleteFeeStructureRes = await request(app)
      .delete(`/api/feeStructureMaster/${appendAcademicYear}`)
      .set(superadminAuth());
    expect(deleteFeeStructureRes.status).toBe(200);
  });

  it("appends tracking row when department is in another matching academicStructure block", async () => {
    const primaryStart = parseInt(testCtx.academicYearPrimary.split("-")[0], 10);
    const splitAcademicYear = `${primaryStart + 2}-${primaryStart + 3}`;

    const createStudentRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollDual, {
        academicYear: testCtx.academicYearPrimary,
      }));
    expect(createStudentRes.status).toBe(201);

    const beforeTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollDual });
    expect(beforeTracking).toBeTruthy();
    expect(beforeTracking.academicYearWiseRecord.some((r) => r.academicYear === testCtx.academicYearPrimary)).toBe(true);

    const promoteRes = await request(app)
      .put(`/api/studentsManagement/${testCtx.studentRollDual}`)
      .set(superadminAuth())
      .send({
        academic: {
          currentAcademicYear: splitAcademicYear,
          currentSemesterNumber: 5,
          departmentName: "IT",
          yearStudying: 3,
        },
      });
    expect(promoteRes.status).toBe(200);

    const splitPayload = buildFeeStructurePayload(splitAcademicYear);
    const itStruct = JSON.parse(JSON.stringify(splitPayload.academicStructures[0]));
    itStruct.departments[0].departmentName = "IT";
    splitPayload.academicStructures.push(itStruct);

    const createSplitFeeRes = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(splitPayload);
    expect(createSplitFeeRes.status).toBe(201);

    const afterTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollDual });
    expect(afterTracking).toBeTruthy();

    const appendedRow = afterTracking.academicYearWiseRecord.find(
      (row) => row.academicYear === splitAcademicYear
    );
    expect(appendedRow).toBeTruthy();
    expect(appendedRow.academic.odd.semesterNumber).toBe(5);
    expect(appendedRow.academic.even.semesterNumber).toBe(6);

    const deleteStudentRes = await request(app)
      .delete(`/api/studentsManagement/${testCtx.studentRollDual}`)
      .set(superadminAuth());
    expect(deleteStudentRes.status).toBe(200);

    const deleteFeeStructureRes = await request(app)
      .delete(`/api/feeStructureMaster/${splitAcademicYear}`)
      .set(superadminAuth());
    expect(deleteFeeStructureRes.status).toBe(200);
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
 