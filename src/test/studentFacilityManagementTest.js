const {
  request, app, testCtx,
  buildStudentPayload, createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster, FeeRefund,
} = require("./setup");
const mongoose = require("mongoose");
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
    
    // Re-assigning transport should update transport details and keep hostel untouched.
    const reassignRes = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdAlt },
        effectiveDate: "2025-08-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.student.transport.isApplicable).toBe(true);
    expect(reassignRes.body.data.student.transport.route).toBe("Kottampatti - Pollachi");
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
    expect(res.body.data.student.transport.isApplicable).toBe(true);
    
    // Re-assigning hostel should update hostel details and keep transport untouched.
    const reassignRes = await request(app)
      .put(`/api/studentFacility/assign/${sfmRollMain}`)
      .set(adminAuth())
      .send({
        hostel: { isApplicable: true, id: hostelIdB },
        effectiveDate: "2025-09-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
      });
    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.data.student.hostel.isApplicable).toBe(true);
    expect(reassignRes.body.data.student.hostel.block).toBe("B");
    expect(reassignRes.body.data.student.transport.isApplicable).toBe(true);
    expect(reassignRes.body.data.student.transport.route).toBe("Kottampatti - Pollachi");
  });

  it("creates reduction payment when assigning facility with reduction > 0", async () => {
    const rollNo = `33CS${testCtx.TS.slice(-3)}`;

    const createRes = await createStudent(rollNo, { academicYear: testCtx.academicYearPrimary });
    expect([200, 201]).toContain(createRes.status);

    const res = await request(app)
      .put(`/api/studentFacility/assign/${rollNo}`)
      .set(adminAuth())
      .send({
        transport: { isApplicable: true, id: transportIdMain },
        effectiveDate: "2025-07-01",
        applyFromAcademicYear: testCtx.academicYearPrimary,
        reduction: 1200,
      });

    expect(res.status).toBe(200);

    const txDoc = await StudentTransaction.findOne({ rollNo }).lean();
    expect(txDoc).toBeTruthy();
    const latestTx = txDoc.transactions[txDoc.transactions.length - 1];
    expect(latestTx.paymentType).toBe("reduction");
    expect(latestTx.reason).toMatch(/partially added transport facility/i);
    expect(latestTx.reason).toMatch(/Reduction amount Rs 1200/i);

    const tracking = await StudentFeeTracking.findOne({ rollNo });
    const yearRecord = tracking.academicYearWiseRecord.find(y => y.academicYear === testCtx.academicYearPrimary);
    expect(yearRecord.transport.total.paid).toBeCloseTo(1200, 2);

    await Promise.all([
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
    ]);
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

    it("allows cancellation without settlement fields when paid amount is zero", async () => {
      const rollNo = `38CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          hostel: {
            isApplicable: true,
            block: "A",
            sharing: 4,
            isAttached: false,
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel/${rollNo}`)
        .set(adminAuth())
        .send({
          facilityType: "hostel",
          applyFromAcademicYear: testCtx.academicYearPrimary,
          endDate: "2026-10-01",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.hostel.isApplicable).toBe(false);
      expect(res.body.data.settlement.paidAmount).toBe(0);
      expect(res.body.data.settlement.refundedAmount).toBe(0);

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("allows cancel without refundMode when conceptionAmount equals paid", async () => {
      const rollNo = `41CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          hostel: {
            isApplicable: true,
            block: "A",
            sharing: 4,
            isAttached: false,
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            hostel: 5000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel/${rollNo}`)
        .set(adminAuth())
        .send({
          facilityType: "hostel",
          applyFromAcademicYear: testCtx.academicYearPrimary,
          endDate: "2026-10-01",
          conceptionAmount: 5000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.settlement.paidAmount).toBeCloseTo(5000, 2);
      expect(res.body.data.settlement.consumedAmount).toBeCloseTo(5000, 2);
      expect(res.body.data.settlement.refundedAmount).toBe(0);
      expect(res.body.data.settlement.refundMode).toBeNull();

      const refundDoc = await FeeRefund.findOne({ rollNo }).lean();
      expect(refundDoc).toBeNull();

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });
  });

  describe("PUT /api/studentFacility/cancel-assign/:rollNo", () => {
    it("cancels hostel and assigns transport in one transaction", async () => {
      const rollNo = `34CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          hostel: {
            isApplicable: true,
            block: "A",
            sharing: 4,
            isAttached: false,
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            hostel: 8000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-1`)
        .send({
          cancel: {
            facilityType: "hostel",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 5000,
            refundMode: "wallet",
          },
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.hostel.isApplicable).toBe(false);
      expect(res.body.data.student.transport.isApplicable).toBe(true);
      expect(res.body.data.student.transport.route).toBe("Bharathiyar University");

      const tracking = await StudentFeeTracking.findOne({ rollNo });
      const yearRecord = tracking.academicYearWiseRecord.find(y => y.academicYear === testCtx.academicYearPrimary);
      expect(yearRecord.hostel.isActive).toBe(false);
      expect(yearRecord.transport.isActive).toBe(true);

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("cancels transport and assigns hostel in one transaction", async () => {
      const rollNo = `35CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          transport: {
            isApplicable: true,
            route: "Bharathiyar University",
            stopName: "Bharathiyar University",
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            transport: 7000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-2`)
        .send({
          cancel: {
            facilityType: "transport",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 3000,
            refundMode: "bank",
            collegeAccount: "SECE-COLLEGE-001",
            studentBankName: "State Bank of India",
            studentAccount: "STUDENT-ACC-9988",
          },
          assign: {
            hostel: {
              isApplicable: true,
              id: hostelIdA,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.transport.isApplicable).toBe(false);
      expect(res.body.data.student.hostel.isApplicable).toBe(true);
      expect(res.body.data.student.hostel.block).toBe("A");

      const refundDoc = await FeeRefund.findOne({ rollNo }).sort({ createdAt: -1 }).lean();
      expect(refundDoc).toBeTruthy();
      expect(refundDoc.collegeAccount).toBe("SECE-COLLEGE-001");
      expect(refundDoc.studentBankName).toBe("State Bank of India");
      expect(refundDoc.studentAccount).toBe("STUDENT-ACC-9988");

      const refundGetRes = await request(app)
        .get(`/api/refund/student/${rollNo}`)
        .set(adminAuth());

      expect(refundGetRes.status).toBe(200);
      expect(Array.isArray(refundGetRes.body.data)).toBe(true);
      expect(refundGetRes.body.data[0].collegeAccount).toBe("SECE-COLLEGE-001");
      expect(refundGetRes.body.data[0].studentBankName).toBe("State Bank of India");
      expect(refundGetRes.body.data[0].studentAccount).toBe("STUDENT-ACC-9988");

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("rejects combined request without x-idempotency-key header", async () => {
      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${sfmRollMain}`)
        .set(adminAuth())
        .send({
          cancel: {
            facilityType: "hostel",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 1000,
            refundMode: "wallet",
          },
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/idempotency/i);
    });

    it("blocks shortcut payload when cancel block is missing", async () => {
      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${sfmRollMain}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-3`)
        .send({
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cancel block is required/i);
    });

    it("does not run assign when cancel step fails", async () => {
      const rollNo = `36CS${testCtx.TS.slice(-3)}`;

      const createRes = await createStudent(rollNo, { academicYear: testCtx.academicYearPrimary });
      expect([200, 201]).toContain(createRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-4`)
        .send({
          cancel: {
            facilityType: "hostel",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 1000,
            refundMode: "wallet",
          },
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(404);

      const studentDoc = await Student.findOne({ "personal.rollNo": rollNo });
      expect(studentDoc.transport?.isApplicable).toBe(false);

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("rolls back cancel and refund when assign step fails", async () => {
      const rollNo = `37CS${testCtx.TS.slice(-3)}`;
      const combinedKey = `sfm-combined-${Date.now()}-5`;
      const invalidHostelId = new mongoose.Types.ObjectId().toString();

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          transport: {
            isApplicable: true,
            route: "Bharathiyar University",
            stopName: "Bharathiyar University",
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            transport: 9000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", combinedKey)
        .send({
          cancel: {
            facilityType: "transport",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 1000,
            refundMode: "wallet",
          },
          assign: {
            hostel: {
              isApplicable: true,
              id: invalidHostelId,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(404);

      const studentDoc = await Student.findOne({ "personal.rollNo": rollNo }).lean();
      expect(studentDoc.transport?.isApplicable).toBe(true);
      expect(studentDoc.hostel?.isApplicable).toBe(false);

      const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();
      const yearRecord = tracking.academicYearWiseRecord.find((y) => y.academicYear === testCtx.academicYearPrimary);
      expect(yearRecord.transport.isActive).toBe(true);
      expect(yearRecord.transport.total.paid).toBeGreaterThan(0);

      const refundDoc = await FeeRefund.findOne({ idempotencyKey: combinedKey }).lean();
      expect(refundDoc).toBeNull();

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("allows cancel-assign without settlement fields when paid amount is zero", async () => {
      const rollNo = `39CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          hostel: {
            isApplicable: true,
            block: "A",
            sharing: 4,
            isAttached: false,
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-6`)
        .send({
          cancel: {
            facilityType: "hostel",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
          },
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.hostel.isApplicable).toBe(false);
      expect(res.body.data.student.transport.isApplicable).toBe(true);
      expect(res.body.data.settlement.paidAmount).toBe(0);
      expect(res.body.data.settlement.refundedAmount).toBe(0);

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("applies assign.reduction in cancel-assign and creates reduction payment", async () => {
      const rollNo = `40CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          transport: {
            isApplicable: true,
            route: "Bharathiyar University",
            stopName: "Bharathiyar University",
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            transport: 7000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-7`)
        .send({
          cancel: {
            facilityType: "transport",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 3000,
            refundMode: "bank",
            collegeAccount: "SECE-COLLEGE-001",
            studentBankName: "Indian Bank",
            studentAccount: "STUDENT-ACC-5566",
          },
          assign: {
            hostel: {
              isApplicable: true,
              id: hostelIdA,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
            reduction: 900,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.hostel.isApplicable).toBe(true);

      const txDoc = await StudentTransaction.findOne({ rollNo }).lean();
      expect(txDoc).toBeTruthy();
      const latestTx = txDoc.transactions[txDoc.transactions.length - 1];
      expect(latestTx.paymentType).toBe("reduction");
      expect(latestTx.reason).toMatch(/partially added hostel facility/i);
      expect(latestTx.reason).toMatch(/Reduction amount Rs 900/i);

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });

    it("rejects cancel-assign when assign.reduction is negative", async () => {
      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${sfmRollMain}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-8`)
        .send({
          cancel: {
            facilityType: "hostel",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
          },
          assign: {
            transport: {
              isApplicable: true,
              id: transportIdMain,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
            reduction: -10,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/assign\.reduction/i);
    });

    it("allows cancel-assign without refundMode when conceptionAmount equals paid", async () => {
      const rollNo = `42CS${testCtx.TS.slice(-3)}`;

      const createRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(rollNo, {
          academicYear: testCtx.academicYearPrimary,
          transport: {
            isApplicable: true,
            route: "Bharathiyar University",
            stopName: "Bharathiyar University",
          },
        }));
      expect([200, 201]).toContain(createRes.status);

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo,
          paymentType: "Cash",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            transport: 6000,
          }],
        });
      expect([200, 201]).toContain(payRes.status);

      const res = await request(app)
        .put(`/api/studentFacility/cancel-assign/${rollNo}`)
        .set(adminAuth())
        .set("x-idempotency-key", `sfm-combined-${Date.now()}-9`)
        .send({
          cancel: {
            facilityType: "transport",
            applyFromAcademicYear: testCtx.academicYearPrimary,
            endDate: "2026-10-01",
            conceptionAmount: 6000,
          },
          assign: {
            hostel: {
              isApplicable: true,
              id: hostelIdA,
            },
            applyFromAcademicYear: testCtx.academicYearPrimary,
            effectiveDate: "2026-10-02",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.transport.isApplicable).toBe(false);
      expect(res.body.data.student.hostel.isApplicable).toBe(true);
      expect(res.body.data.settlement.refundedAmount).toBe(0);
      expect(res.body.data.settlement.refundMode).toBeNull();

      const refundDoc = await FeeRefund.findOne({ rollNo }).lean();
      expect(refundDoc).toBeNull();

      await Promise.all([
        StudentTransaction.deleteMany({ rollNo }),
        FeeRefund.deleteMany({ rollNo }),
        StudentFeeTracking.deleteMany({ rollNo }),
        Student.deleteMany({ "personal.rollNo": rollNo }),
      ]);
    });
  });

});
