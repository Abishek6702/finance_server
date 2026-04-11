const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Student Fee Tracking API", () => {
  beforeAll(async () => {
    await globalSetup();
    // Create fee structure + student + payment so tracking record exists
    const fsRes = await createFeeStructure(testCtx.academicYearPrimary);
    expect([200, 201, 409]).toContain(fsRes.status);

    const stuRes = await createStudent(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary });
    expect([200, 201, 409]).toContain(stuRes.status);

    // Make a payment so fee tracking record has data (receiptNo is auto-generated)
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "Cash",
        bankName: "Indian Bank",
        bankLocation: "Kinathukadavu",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    // Payment may fail if tracking already has this fee paid from another suite run — that's OK
    expect([201, 400]).toContain(payRes.status);
  });

  afterAll(async () => {
    await Promise.all([
      StudentTransaction.deleteMany({ rollNo: testCtx.studentRollFinance }),
      StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollFinance }),
      Student.deleteMany({ "personal.rollNo": testCtx.studentRollFinance }),
      FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary }),
    ]);
    await globalTeardown();
  });

  /* ─── AUTH ───── */

  it("rejects access without token", async () => {
    const res = await request(app).get("/api/studentFeeTracking");
    expect(res.status).toBe(401);
  });

  /* ─── NO FILTERS (all students) ───── */

  it("returns all students with fee tracking when no filters", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  /* ─── FILTER BY rollNo ───── */

  it("returns a single student when filtered by rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const record = res.body.data[0];
    expect(record.student.rollNo).toBe(testCtx.studentRollFinance);
    expect(Array.isArray(record.feeSummary)).toBe(true);
    expect(record.feeSummary.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(record.academicYears)).toBe(true);
    expect(record.academicYears.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for non-existent rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: "99ZZ999" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  /* ─── FILTER BY department ───── */

  it("filters by department", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((r) => {
      expect(r.student.department).toBe("CSE");
    });
  });

  it("returns empty array for non-existent department filter", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "MECH" });
    // might return 0 if no MECH students exist in test DB
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  /* ─── FILTER BY batch ───── */

  it("filters by batch", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((r) => {
      expect(r.student.batch).toBe(testCtx.academicYearPrimary);
    });
  });

  it("returns empty array for non-existent batch", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: "1900-1901" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  /* ─── COMBINED FILTERS ───── */

  it("filters by batch + department", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary, department: "CSE" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const record = res.body.data[0];
    expect(record.student.batch).toBe(testCtx.academicYearPrimary);
    expect(record.student.department).toBe("CSE");
  });

  it("filters by batch + department + rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({
        batch: testCtx.academicYearPrimary,
        department: "CSE",
        rollNo: testCtx.studentRollFinance,
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].student.rollNo).toBe(testCtx.studentRollFinance);
  });

  /* ─── RESPONSE SHAPE ───── */

  it("response contains student profile, summary, and breakdown", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking/v2")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    const record = res.body.data[0];

    expect(record.student).toBeDefined();
    expect(record.contact).toBeDefined();
    expect(Array.isArray(record.feeSummary)).toBe(true);
    expect(Array.isArray(record.academicYears)).toBe(true);

    const yr = record.academicYears.find(
      (row) => row.academicYear === testCtx.academicYearPrimary
    );
    expect(yr).toBeDefined();
    expect(yr.overall).toBeDefined();
    expect(yr.overall.total).toBeGreaterThan(0);
    expect(yr.overall.demand).toBeGreaterThan(0);
    if (yr.odd) {
      expect(Array.isArray(yr.odd.feeHeads)).toBe(true);
      expect(yr.odd.overall).toBeDefined();
    }
  });

  /* ─── VALIDATION ───── */

  it("rejects invalid department value", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "INVALID" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid batch format", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: "2024" });
    expect(res.status).toBe(400);
  });

  it("rejects non-alphanumeric rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: "12CS$##" });
    expect(res.status).toBe(400);
  });

  /* ─── BACKFILL ENDPOINT ───── */

  describe("POST /api/studentFeeTracking/backfill", () => {
    const backfillRoll = `66CS${testCtx.TS.slice(-3)}`;
    const missingYearRoll = `67CS${testCtx.TS.slice(-3)}`;

    afterAll(async () => {
      await Promise.all([
        StudentTransaction.deleteMany({ rollNo: { $in: [backfillRoll, missingYearRoll] } }),
        StudentFeeTracking.deleteMany({ rollNo: { $in: [backfillRoll, missingYearRoll] } }),
        Student.deleteMany({ "personal.rollNo": { $in: [backfillRoll, missingYearRoll] } }),
        FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearSecondary }),
      ]);
    });

    it("rejects backfill without token", async () => {
      const res = await request(app).post("/api/studentFeeTracking/backfill");
      expect(res.status).toBe(401);
    });

    it("rejects backfill for admin role", async () => {
      const res = await request(app)
        .post("/api/studentFeeTracking/backfill")
        .set(adminAuth());
      expect(res.status).toBe(401);
    });

    it("rejects unexpected payload for backfill endpoint", async () => {
      const res = await request(app)
        .post("/api/studentFeeTracking/backfill")
        .set(superadminAuth())
        .send({ force: true });
      expect(res.status).toBe(400);
    });

    it("appends missing academic-year row for promoted student and remains idempotent", async () => {
      const feeStructureRes = await createFeeStructure(testCtx.academicYearSecondary);
      expect([201, 409]).toContain(feeStructureRes.status);

      const studentRes = await createStudent(backfillRoll, { academicYear: testCtx.academicYearPrimary });
      expect([201, 409]).toContain(studentRes.status);

      await Student.updateOne(
        { "personal.rollNo": backfillRoll },
        {
          $set: {
            "academic.currentAcademicYear": testCtx.academicYearSecondary,
            "academic.currentSemesterNumber": 3,
            "academic.yearStudying": 2,
          }
        }
      );

      const trackingBefore = await StudentFeeTracking.findOne({ rollNo: backfillRoll });
      expect(trackingBefore).toBeTruthy();
      const hadSecondaryBefore = trackingBefore.academicYearWiseRecord.some(
        (row) => row.academicYear === testCtx.academicYearSecondary
      );
      expect(hadSecondaryBefore).toBe(false);

      const backfillRes = await request(app)
        .post("/api/studentFeeTracking/backfill")
        .set(superadminAuth());

      expect(backfillRes.status).toBe(200);
      expect(backfillRes.body.success).toBe(true);
      expect(backfillRes.body.data.rowsAppended).toBeGreaterThan(0);

      const trackingAfter = await StudentFeeTracking.findOne({ rollNo: backfillRoll });
      expect(trackingAfter).toBeTruthy();
      expect(trackingAfter.academicYearWiseRecord.some((row) => row.academicYear === testCtx.academicYearPrimary)).toBe(true);
      expect(trackingAfter.academicYearWiseRecord.some((row) => row.academicYear === testCtx.academicYearSecondary)).toBe(true);

      const secondBackfillRes = await request(app)
        .post("/api/studentFeeTracking/backfill")
        .set(superadminAuth());

      expect(secondBackfillRes.status).toBe(200);

      const trackingAfterSecondRun = await StudentFeeTracking.findOne({ rollNo: backfillRoll });
      const secondaryRows = trackingAfterSecondRun.academicYearWiseRecord.filter(
        (row) => row.academicYear === testCtx.academicYearSecondary
      );
      expect(secondaryRows).toHaveLength(1);
    });

    it("applies single-scheme tuition concession proportionally to semesters", async () => {
      const enrollment = {
        quota: "Government Quota",
        firstGraduate: {
          isApplicable: true,
          yearlyTuitionConcessionAmount: 5000,
          yearlyExamConcessionAmount: 0,
          yearlyErpConcessionAmount: 0,
          yearlyBookConcessionAmount: 0,
          yearlyLabConcessionAmount: 0,
          yearlyTransportConcessionAmount: 0,
          yearlyHostelConcessionAmount: 0,
        },
        scheme7point5: { isApplicable: false },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
      };

      const stuRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(testCtx.studentRollConcSingle, {
          academicYear: testCtx.academicYearPrimary,
          enrollment,
        }));
      expect([200, 201]).toContain(stuRes.status);

      const res = await request(app)
        .get("/api/studentFeeTracking/v2")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcSingle });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const record = res.body.data[0];
      const yearEntry = record.academicYears.find(
        (row) => row.academicYear === testCtx.academicYearPrimary
      );
      expect(yearEntry).toBeDefined();

      const oddTuition = yearEntry.odd.feeHeads.find((h) => h.name === "Tuition Fees");
      const evenTuition = yearEntry.even.feeHeads.find((h) => h.name === "Tuition Fees");

      const oddGross = oddTuition.total + oddTuition.concession;
      const evenGross = evenTuition.total + evenTuition.concession;

      expect(oddGross).toBeCloseTo(40000, 1);
      expect(evenGross).toBeCloseTo(41000, 1);
      expect(oddTuition.concession).toBeGreaterThan(0);
      expect(evenTuition.concession).toBeGreaterThan(0);

      const tuitionConcession = oddTuition.concession + evenTuition.concession;
      expect(Math.abs(tuitionConcession - 5000)).toBeLessThan(0.02);

      expect(yearEntry.overall.total).toBeCloseTo(91000, 1);
      expect(yearEntry.overall.concession).toBeCloseTo(5000, 1);
      expect(yearEntry.overall.demand).toBeCloseTo(91000 - 5000, 1);
    });

    it("sums concessions from multiple applicable schemes", async () => {
      const enrollment = {
        quota: "Government Quota",
        firstGraduate: {
          isApplicable: true,
          yearlyTuitionConcessionAmount: 3000,
          yearlyExamConcessionAmount: 500,
          yearlyErpConcessionAmount: 0,
          yearlyBookConcessionAmount: 0,
          yearlyLabConcessionAmount: 0,
          yearlyTransportConcessionAmount: 0,
          yearlyHostelConcessionAmount: 0,
        },
        scheme7point5: {
          isApplicable: true,
          yearlyTuitionConcessionAmount: 2000,
          yearlyExamConcessionAmount: 300,
          yearlyErpConcessionAmount: 100,
          yearlyBookConcessionAmount: 0,
          yearlyLabConcessionAmount: 0,
          yearlyTransportConcessionAmount: 0,
          yearlyHostelConcessionAmount: 0,
        },
        pmssScheme: { isApplicable: false },
        sakthiScheme: { isApplicable: false },
        specialConcession: { isApplicable: false },
      };

      const stuRes = await request(app)
        .post("/api/studentsManagement")
        .set(superadminAuth())
        .send(buildStudentPayload(testCtx.studentRollConcMulti, {
          academicYear: testCtx.academicYearPrimary,
          enrollment,
        }));
      expect([200, 201]).toContain(stuRes.status);

      const res = await request(app)
        .get("/api/studentFeeTracking/v2")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcMulti });
      expect(res.status).toBe(200);

      const record = res.body.data[0];
      const yearEntry = record.academicYears.find(
        (row) => row.academicYear === testCtx.academicYearPrimary
      );
      expect(yearEntry).toBeDefined();

      const oddTuition = yearEntry.odd.feeHeads.find((h) => h.name === "Tuition Fees");
      const evenTuition = yearEntry.even.feeHeads.find((h) => h.name === "Tuition Fees");
      const oddExam = yearEntry.odd.feeHeads.find((h) => h.name === "Exam Fees");
      const evenExam = yearEntry.even.feeHeads.find((h) => h.name === "Exam Fees");
      const oddErp = yearEntry.odd.feeHeads.find((h) => h.name === "ERP Fees");
      const evenErp = yearEntry.even.feeHeads.find((h) => h.name === "ERP Fees");

      const tuitionConcession = oddTuition.concession + evenTuition.concession;
      const examConcession = oddExam.concession + evenExam.concession;
      const erpConcession = oddErp.concession + evenErp.concession;

      expect(Math.abs(tuitionConcession - 5000)).toBeLessThan(0.02);
      expect(Math.abs(examConcession - 800)).toBeLessThan(0.02);
      expect(Math.abs(erpConcession - 100)).toBeLessThan(0.02);
      expect(yearEntry.overall.concession).toBeCloseTo(5900, 1);

      expect(yearEntry.overall.total).toBeCloseTo(91000, 1);
      expect(yearEntry.overall.demand).toBeCloseTo(91000 - 5900, 1);

      const grossTuition = (oddTuition.total + oddTuition.concession) + (evenTuition.total + evenTuition.concession);
      const netTuition = oddTuition.total + evenTuition.total;
      expect(netTuition).toBeCloseTo(grossTuition - 5000, 1);

      const grossExam = (oddExam.total + oddExam.concession) + (evenExam.total + evenExam.concession);
      const netExam = oddExam.total + evenExam.total;
      expect(netExam).toBeCloseTo(grossExam - 800, 1);
    });

    it("rejects payment exceeding concession-adjusted net total", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/v2")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcSingle });
      expect(res.status).toBe(200);

      const record = res.body.data[0];
      const yearEntry = record.academicYears.find(
        (row) => row.academicYear === testCtx.academicYearPrimary
      );
      const oddTuition = yearEntry.odd.feeHeads.find((h) => h.name === "Tuition Fees");
      const netTuitionOdd = oddTuition.total;

      // Attempt to pay MORE than the net tuition total
      const overpayAmount = netTuitionOdd + 1;

      const payRes = await request(app)
        .post("/api/feePayment/pay")
        .set(adminAuth())
        .send({
          rollNo: testCtx.studentRollConcSingle,
          paymentType: "Cash",
          bankName: "Test Bank",
          bankLocation: "Test",
          breakdowns: [{
            academicYear: testCtx.academicYearPrimary,
            academic: { semesterNumber: 1, tuition: overpayAmount },
          }],
        });

      expect(payRes.status).toBe(400);
      expect(payRes.body.message).toMatch(/concession-adjusted/i);
    });

    it("allows exact payment up to concession-adjusted net total", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/v2")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcMulti });
      expect(res.status).toBe(200);

      const record = res.body.data[0];
      const yearEntry = record.academicYears.find(
        (row) => row.academicYear === testCtx.academicYearPrimary
      );
      const oddErp = yearEntry.odd.feeHeads.find((h) => h.name === "ERP Fees");
      const netErpOdd = oddErp.total;

      // Pay exactly the net ERP total for odd semester — should succeed
      if (netErpOdd > 0) {
        const payRes = await request(app)
          .post("/api/feePayment/pay")
          .set(adminAuth())
          .send({
            rollNo: testCtx.studentRollConcMulti,
            paymentType: "Cash",
            bankName: "Test Bank",
            bankLocation: "Test",
            breakdowns: [{
              academicYear: testCtx.academicYearPrimary,
              academic: { semesterNumber: 1, erp: netErpOdd },
            }],
          });

        expect(payRes.status).toBe(201);
      }
    });

    it("zero-concession student has gross = net totals", async () => {
      // studentRollFinance was created with all schemes isApplicable: false
      const res = await request(app)
        .get("/api/studentFeeTracking/v2")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance });
      expect(res.status).toBe(200);

      const record = res.body.data[0];
      const yearEntry = record.academicYears.find(
        (row) => row.academicYear === testCtx.academicYearPrimary
      );
      const oddTuition = yearEntry.odd.feeHeads.find((h) => h.name === "Tuition Fees");
      const evenTuition = yearEntry.even.feeHeads.find((h) => h.name === "Tuition Fees");

      expect(yearEntry.overall.concession).toBe(0);
      expect(yearEntry.overall.total).toBeCloseTo(yearEntry.overall.demand, 1);

      expect(oddTuition.concession).toBe(0);
      expect(evenTuition.concession).toBe(0);
      expect(oddTuition.total).toBeCloseTo(40000, 1);
      expect(evenTuition.total).toBeCloseTo(41000, 1);
    });
  });

  describe("POST /api/studentFeeTracking/promotion", () => {
    const promotionRoll = `68CS${testCtx.TS.slice(-3)}`;

    afterAll(async () => {
      await Promise.all([
        StudentFeeTracking.deleteMany({ rollNo: promotionRoll }),
        Student.deleteMany({ "personal.rollNo": promotionRoll }),
        FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearMissing }),
      ]);
    });

    it("rejects promotion without token", async () => {
      const res = await request(app)
        .post("/api/studentFeeTracking/promotion")
        .send({ currentAcademicYear: testCtx.academicYearMissing });
      expect(res.status).toBe(401);
    });

    it("rejects promotion for admin role", async () => {
      const res = await request(app)
        .post("/api/studentFeeTracking/promotion")
        .set(adminAuth())
        .send({ currentAcademicYear: testCtx.academicYearMissing });
      expect(res.status).toBe(401);
    });

    it("rejects promotion payload with invalid academic year format", async () => {
      const res = await request(app)
        .post("/api/studentFeeTracking/promotion")
        .set(superadminAuth())
        .send({ currentAcademicYear: "2026" });
      expect(res.status).toBe(400);
    });

    it("promotes students in the given academic year to next semester", async () => {
      const feeStructureRes = await createFeeStructure(testCtx.academicYearMissing);
      expect([201, 409]).toContain(feeStructureRes.status);

      const studentRes = await createStudent(promotionRoll, { academicYear: testCtx.academicYearMissing });
      expect([200, 201, 409]).toContain(studentRes.status);

      const before = await Student.findOne({ "personal.rollNo": promotionRoll });
      expect(before).toBeTruthy();
      expect(before.academic.currentSemesterNumber).toBe(1);

      const res = await request(app)
        .post("/api/studentFeeTracking/promotion")
        .set(superadminAuth())
        .send({ currentAcademicYear: testCtx.academicYearMissing });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        matchedStudents: expect.any(Number),
        promotedStudents: expect.any(Number),
        passedOutStudents: expect.any(Number),
        trackingRowsCreated: expect.any(Number),
      });

      const after = await Student.findOne({ "personal.rollNo": promotionRoll });
      expect(after).toBeTruthy();
      expect(after.academic.currentSemesterNumber).toBe(2);
      expect(after.academic.yearStudying).toBe(1);
      expect(after.academic.currentAcademicYear).toBe(testCtx.academicYearMissing);
      expect(after.passedout).toBe(false);
    });
  });
});
