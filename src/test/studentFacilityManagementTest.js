const {
  request, app, testCtx,
  buildStudentPayload, createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");
const { Transport } = require("../api/fee-structure/transport/modelTransport");
const { Hostel } = require("../api/fee-structure/hostel/modelHostel");

let sfmRollMain;        // general-purpose student — no initial facility
let sfmRollTransGuard;  // student with transport, payment made → 409 transport guard
let sfmRollHostelGuard; // student with hostel, payment made → 409 hostel guard

let transportIdMain, transportIdAlt;
let hostelIdA, hostelIdB, hostelIdC, hostelIdD;

describe("Student Facility Management API", () => {
  beforeAll(async () => {
    await globalSetup();

    sfmRollMain        = `30CS${testCtx.TS.slice(-3)}`;
    sfmRollTransGuard  = `31CS${testCtx.TS.slice(-3)}`;
    sfmRollHostelGuard = `32CS${testCtx.TS.slice(-3)}`;

    await createFeeStructure(testCtx.academicYearPrimary);

    const tMain = await Transport.findOne({ route: "Bharathiyar University" });
    transportIdMain = tMain ? tMain._id.toString() : null;
    const tAlt = await Transport.findOne({ route: "Kottampatti - Pollachi" });
    transportIdAlt = tAlt ? tAlt._id.toString() : null;
    
    const hA = await Hostel.findOne({ block: "A", sharing: 4, isAttached: false });
    hostelIdA = hA ? hA._id.toString() : null;
    const hB = await Hostel.findOne({ block: "B", sharing: 3, isAttached: false });
    hostelIdB = hB ? hB._id.toString() : null;
    const hC = await Hostel.findOne({ block: "C" });
    hostelIdC = hC ? hC._id.toString() : null;
    const hD = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    hostelIdD = hD ? hD._id.toString() : null;

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
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .send({
        transport: { isApplicable: true, id: transportIdMain },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(401);
  });

  /* ─── VALIDATION ────────────────────────────────────── */
  it("rejects when applyFromAcademicYear is missing", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({ transport: { isApplicable: true, id: transportIdMain } });
    expect(res.status).toBe(400);
  });

  it("rejects invalid applyFromAcademicYear format", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({ transport: { isApplicable: true, id: transportIdMain }, applyFromAcademicYear: "2025/2026" });
    expect(res.status).toBe(400);
  });

  it("rejects when neither transport nor hostel provided", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({ applyFromAcademicYear: testCtx.academicYearPrimary });
    expect(res.status).toBe(400);
  });

  it("rejects assignment if isApplicable is false", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: false },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
  });

  it("rejects transport missing id", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
  });

  it("rejects hostel missing id", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
  });

  it("rejects assignment when effectiveDate is missing", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdMain },
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/effectiveDate/i);
  });

  /* ─── SERVICE ERRORS ──────────────────────────────── */
  it("returns 404 for unknown student", async () => {
    const res = await request(app)
      .put("/api/studentFacility/assign/99CS999")
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdMain },
        effectiveDate: "2025-07-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(404);
  });

  /* ─── SUCCESS FLOWS ────────────────────────────────── */
  it("assigns transport successfully", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdMain },
        effectiveDate: "2025-07-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.student.transport.isApplicable).toBe(true);
    
    // Attempting to re-assign should fail due to active guard
    const activeRes = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdAlt },
        effectiveDate: "2025-08-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(activeRes.status).toBe(400);
  });

  it("assigns hostel successfully while transport remains active", async () => {
    const res = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, id: hostelIdA },
        effectiveDate: "2025-08-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.student.hostel.isApplicable).toBe(true);
    expect(res.body.data.student.hostel.block).toBe("A");
    
    // Active guard for hostel
    const activeRes = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, id: hostelIdB },
        effectiveDate: "2025-09-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(activeRes.status).toBe(400);
  });

  describe("PUT /api/studentFacility/cancel/:rollNo", () => {
    it("successfully cancels hostel facility and settles via wallet", async () => {
      // Add a small payment to hostel
       await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo: sfmRollMain,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            hostel: 6000,
          }],
        });

      const payload = {
        facilityType: "hostel",
        applyFromAcademicYear: testCtx.academicYearPrimary,
        endDate: "2025-09-01",
        conceptionAmount: 5000,
        refundMode: "wallet",
        refundAmount: 1000
      };

      const res = await request(app)
        .put(`/api/studentFacility/cancel/${sfmRollMain}`)
        .set(adminAuth())
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.student.hostel.isApplicable).toBe(false);
      
      const tracking = await StudentFeeTracking.findOne({ rollNo: sfmRollMain });
      const yearRecord = tracking.academicYearWiseRecord.find(y => y.academicYear === testCtx.academicYearPrimary);
      expect(yearRecord.hostel.isActive).toBe(false);
    });

    it("rejects duplicate removal request", async () => {
      const payload = {
        facilityType: "hostel",
        applyFromAcademicYear: testCtx.academicYearPrimary,
        endDate: "2025-09-01",
        conceptionAmount: 5000,
        refundMode: "wallet",
        refundAmount: 1000
      };

      const res = await request(app)
        .put(`/api/studentFacility/cancel/${sfmRollMain}`)
        .set(adminAuth())
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already inactive/i);
    });
  });

});
