const {
  request, app, testCtx,
  buildStudentPayload, createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

/* ======================================================
   Roll numbers local to this suite
   Using prefix 30-32 (not used by any other test file)
====================================================== */
let sfmRollMain;        // general-purpose student — no initial facility
let sfmRollTransGuard;  // student with transport, payment made → 409 transport guard
let sfmRollHostelGuard; // student with hostel, payment made → 409 hostel guard

describe("Student Facility Management API", () => {
  beforeAll(async () => {
    await globalSetup();

    sfmRollMain        = `30CS${testCtx.TS.slice(-3)}`;
    sfmRollTransGuard  = `31CS${testCtx.TS.slice(-3)}`;
    sfmRollHostelGuard = `32CS${testCtx.TS.slice(-3)}`;

    /* fee structure must exist for tracking to be generated */
    await createFeeStructure(testCtx.academicYearPrimary);

    /* sfmRollMain: no transport, no hostel */
    await createStudent(sfmRollMain, { academicYear: testCtx.academicYearPrimary });

    /* sfmRollTransGuard: created with transport */
    const transRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(sfmRollTransGuard, {
        academicYear: testCtx.academicYearPrimary,
        transport: {
          isApplicable: true,
          route: "Bharathiyar University",
          stopName: "Bharathiyar University",
        },
      }));
    expect([201, 409]).toContain(transRes.status);

    /* sfmRollHostelGuard: created with hostel */
    const hostelRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(sfmRollHostelGuard, {
        academicYear: testCtx.academicYearPrimary,
        hostel: {
          isApplicable: true,
          block: "A",
          sharing: 4,
          isAttached: false,
        },
      }));
    expect([201, 409]).toContain(hostelRes.status);

    /* Make a partial transport payment on sfmRollTransGuard */
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: sfmRollTransGuard,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          transport: 5000,
        }],
      });

    /* Make a partial hostel payment on sfmRollHostelGuard */
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: sfmRollHostelGuard,
        paymentType: "Cash",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          hostel: 10000,
        }],
      });
  });

  afterAll(async () => {
    const rolls = [sfmRollMain, sfmRollTransGuard, sfmRollHostelGuard];
    await Promise.all([
      StudentTransaction.deleteMany({ rollNo: { $in: rolls } }),
      StudentFeeTracking.deleteMany({ rollNo: { $in: rolls } }),
      Student.deleteMany({ "personal.rollNo": { $in: rolls } }),
      FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary }),
    ]);
    await globalTeardown();
  });

  /* ─── AUTH ─────────────────────────────────────────── */

  it("rejects request without token", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(401);
  });

  /* ─── VALIDATION ────────────────────────────────────── */

  it("rejects when applyFromAcademicYear is missing", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({ transport: { isApplicable: false } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/applyFromAcademicYear/i);
  });

  it("rejects invalid applyFromAcademicYear format", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({ transport: { isApplicable: false }, applyFromAcademicYear: "2025/2026" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/YYYY-YYYY/i);
  });

  it("rejects when neither transport nor hostel provided", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({ applyFromAcademicYear: testCtx.academicYearPrimary });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/transport.*hostel|hostel.*transport/i);
  });

  it("rejects hostel.isApplicable true without block", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, sharing: 4, isAttached: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hostel\.block/i);
  });

  it("rejects hostel.isApplicable true without sharing", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, block: "A", isAttached: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hostel\.sharing/i);
  });

  it("rejects transport.isApplicable true without stopName", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, route: "Bharathiyar University" },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/transport\.stopName/i);
  });

  it("rejects transport.isApplicable true without route", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, stopName: "Bharathiyar University" },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/transport\.route/i);
  });

  /* ─── SERVICE ERRORS ──────────────────────────────── */

  it("returns 404 for unknown student", async () => {
    const res = await request(app)
      .put("/api/studentFacility/99CS999")
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/student not found/i);
  });

  it("returns 400 when applyFromAcademicYear is before currentAcademicYear", async () => {
    const yearStart = parseInt(testCtx.academicYearPrimary.split("-")[0], 10);
    const pastYear = `${yearStart - 1}-${yearStart}`;
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: pastYear,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be before/i);
  });

  it("returns 400 when applyFromAcademicYear is outside batch range (after batch end)", async () => {
    /* batch = "YYYY-YYYY+1", so applyFrom = "YYYY+1-YYYY+2" is outside */
    const yearStart = parseInt(testCtx.academicYearPrimary.split("-")[0], 10);
    const outsideYear = `${yearStart + 1}-${yearStart + 2}`;
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: outsideYear,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/batch range/i);
  });

  it("returns 404 when hostel config not found in master", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, block: "Z", sharing: 9, isAttached: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/hostel not found/i);
  });

  it("returns 404 when transport stop not found in master", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, route: "NonExistent Route", stopName: "Ghost Stop" },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/transport not found/i);
  });

  /* ─── SUCCESS FLOWS ──────────────────────────────────
     Tests run sequentially and sfmRollMain state evolves:
     none → transport → hostel → hostel-B → hostel-B+transport → hostel-B → both-false
  ────────────────────────────────────────────────────── */

  it("assigns transport to a student who had none", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Bharathiyar University" },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const student = res.body.data.student;
    expect(student.transport.isApplicable).toBe(true);
    expect(student.transport.route).toBe("Bharathiyar University");
    expect(student.transport.fee).toBe(15000);

    /* Verify tracking was updated */
    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.transport).toBeTruthy();
    expect(yearRecord.transport.subTotal).toBe(15000);
    expect(yearRecord.transport.total.total).toBe(15000); // no concession
  });

  it("transfers student from transport to hostel (transport cleared)", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        hostel: { isApplicable: true, block: "A", sharing: 4, isAttached: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);

    const student = res.body.data.student;
    expect(student.transport.isApplicable).toBe(false);
    expect(student.hostel.isApplicable).toBe(true);
    expect(student.hostel.block).toBe("A");
    expect(student.hostel.fee).toBe(55000);

    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.transport).toBeNull();
    expect(yearRecord.hostel.subTotal).toBe(55000);
    expect(yearRecord.hostel.total.total).toBe(55000);
  });

  it("transfers student from hostel A to hostel B (different config)", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, block: "B", sharing: 3, isAttached: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);

    const student = res.body.data.student;
    expect(student.hostel.block).toBe("B");
    expect(student.hostel.sharing).toBe(3);
    expect(student.hostel.fee).toBe(65000);

    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.hostel.subTotal).toBe(65000);
    expect(yearRecord.hostel.total.total).toBe(65000);
  });

  it("assigns transport without touching hostel (transport added, hostel intact)", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, route: "Kottampatti - Pollachi", stopName: "Kottampatti" },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);

    const student = res.body.data.student;
    expect(student.transport.isApplicable).toBe(true);
    expect(student.transport.route).toBe("Kottampatti - Pollachi");
    expect(student.hostel.isApplicable).toBe(true); // still has hostel
    expect(student.hostel.block).toBe("B");

    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.transport.fee).toBe(12000);
    expect(yearRecord.hostel.subTotal).toBe(65000); // hostel unchanged
  });

  it("sets only transport to false (hostel untouched)", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);

    const student = res.body.data.student;
    expect(student.transport.isApplicable).toBe(false);
    expect(student.hostel.isApplicable).toBe(true); // hostel still there

    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.transport).toBeNull();
    expect(yearRecord.hostel).toBeTruthy();
  });

  it("sets both transport and hostel to false", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        hostel: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);

    const student = res.body.data.student;
    expect(student.transport.isApplicable).toBe(false);
    expect(student.hostel.isApplicable).toBe(false);

    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(yearRecord.transport).toBeNull();
    expect(yearRecord.hostel).toBeNull();
    /* Year total should now be academic only */
    expect(yearRecord.total.total).toBe(yearRecord.academic.total.total);
  });

  it("returns 200 when both already false and set to false again (no-op, note message)", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        hostel: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /* ─── 409 GUARD TESTS ─────────────────────────────── */

  it("rejects transport change when transport fee is already Partial (409)", async () => {
    /* Verify the setup payment created a Partial status */
    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollTransGuard });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(["Partial"]).toContain(yearRecord.transport.total.status);

    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollTransGuard}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/transport.*Partial|Partial.*transport/i);
  });

  it("rejects hostel change when hostel fee is already Partial (409)", async () => {
    const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollHostelGuard });
    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === testCtx.academicYearPrimary
    );
    expect(["Partial"]).toContain(yearRecord.hostel.total.status);

    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollHostelGuard}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/hostel.*Partial|Partial.*hostel/i);
  });

  it("allows changing a different facility even when one has Partial status", async () => {
    /* sfmRollTransGuard has transport Partial, but hostel is untouched → should allow hostel change */
    const res = await request(app)
      .put(`/api/studentFacility/${sfmRollTransGuard}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, block: "C", sharing: 2, isAttached: true },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.student.hostel.isApplicable).toBe(true);
  });
});
