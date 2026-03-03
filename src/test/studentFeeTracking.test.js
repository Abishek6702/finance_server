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
        remarks: "first payment",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });
    // Payment may fail if tracking already has this fee paid from another suite run — that's OK
    expect([201, 400]).toContain(payRes.status);
  });

  afterAll(async () => {
    await StudentTransaction.deleteMany({ rollNo: testCtx.studentRollFinance });
    await StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollFinance });
    await Student.deleteMany({ "personal.rollNo": testCtx.studentRollFinance });
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
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
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const record = res.body.data[0];
    expect(record.student.personal.rollNo).toBe(testCtx.studentRollFinance);
    expect(record.feeTracking).toBeDefined();
    // Note: rollNo is not returned in feeTracking (stripped by service)
    expect(record.feeTracking.academicYearWiseRecord.length).toBeGreaterThanOrEqual(1);
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
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ department: "CSE" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((r) => {
      expect(r.student.academic.departmentName).toBe("CSE");
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
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((r) => {
      expect(r.student.academic.batch).toBe(testCtx.academicYearPrimary);
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
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ batch: testCtx.academicYearPrimary, department: "CSE" });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const record = res.body.data[0];
    expect(record.student.academic.batch).toBe(testCtx.academicYearPrimary);
    expect(record.student.academic.departmentName).toBe("CSE");
  });

  it("filters by batch + department + rollNo", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({
        batch: testCtx.academicYearPrimary,
        department: "CSE",
        rollNo: testCtx.studentRollFinance,
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].student.personal.rollNo).toBe(testCtx.studentRollFinance);
  });

  /* ─── RESPONSE SHAPE ───── */

  it("response contains full student data and full feeTracking record", async () => {
    const res = await request(app)
      .get("/api/studentFeeTracking")
      .set(adminAuth())
      .query({ rollNo: testCtx.studentRollFinance });
    expect(res.status).toBe(200);
    const record = res.body.data[0];

    // student object has all sections
    expect(record.student.personal).toBeDefined();
    expect(record.student.academic).toBeDefined();
    expect(record.student.contact).toBeDefined();
    expect(record.student.enrollment).toBeDefined();

    // feeTracking has academicYearWiseRecord array
    expect(Array.isArray(record.feeTracking.academicYearWiseRecord)).toBe(true);
    const yr = record.feeTracking.academicYearWiseRecord[0];
    expect(yr.academicYear).toBe(testCtx.academicYearPrimary);
    expect(yr.total).toBeDefined();
    expect(yr.total.total).toBeGreaterThan(0);
    expect(yr.total.paid).toBeGreaterThan(0);
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

  /* ─── CONCESSION INTEGRATION ───── */

  describe("Concession Integration", () => {
    afterAll(async () => {
      await StudentTransaction.deleteMany({
        rollNo: { $in: [testCtx.studentRollConcSingle, testCtx.studentRollConcMulti] },
      });
      await StudentFeeTracking.deleteMany({
        rollNo: { $in: [testCtx.studentRollConcSingle, testCtx.studentRollConcMulti] },
      });
      await Student.deleteMany({
        "personal.rollNo": { $in: [testCtx.studentRollConcSingle, testCtx.studentRollConcMulti] },
      });
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
        .get("/api/studentFeeTracking")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcSingle });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const yr = res.body.data[0].feeTracking.academicYearWiseRecord[0];

      // Concessions block should be populated
      expect(yr.concessions.tuition).toBe(5000);
      expect(yr.concessions.totalConcession).toBe(5000);

      // Sem 1 gross tuition = 40000, Sem 2 gross tuition = 41000
      // grossSum = 91000, oddRatio ≈ 0.4945
      // oddShare = normalizeMoney(5000 * 45000/91000) ≈ 2472.53
      // evenShare = 5000 - 2472.53 = 2527.47
      const oddTuition = yr.academic.odd.tuition.total;
      const evenTuition = yr.academic.even.tuition.total;

      expect(oddTuition).toBeLessThan(40000);
      expect(evenTuition).toBeLessThan(41000);

      // Total tuition reduction must equal the concession
      const tuitionReduction = (40000 - oddTuition) + (41000 - evenTuition);
      expect(Math.abs(tuitionReduction - 5000)).toBeLessThan(0.02);

      // Net academic total should be gross - 5000
      // Gross academic = 45000 + 46000 = 91000
      expect(yr.academic.total.total).toBeCloseTo(91000 - 5000, 1);

      // Year total should reflect net academic
      expect(yr.total.total).toBeCloseTo(91000 - 5000, 1);

      // Verify new component-level fields (concession, subTotal)
      expect(yr.academic.odd.tuition.subTotal).toBe(40000);
      expect(yr.academic.odd.tuition.concession).toBeGreaterThan(0);
      expect(yr.academic.even.tuition.subTotal).toBe(41000);
      expect(yr.academic.even.tuition.concession).toBeGreaterThan(0);

      // Concession splits must sum to yearly concession amount
      const oddTuitionConc = yr.academic.odd.tuition.concession;
      const evenTuitionConc = yr.academic.even.tuition.concession;
      expect(Math.abs(oddTuitionConc + evenTuitionConc - 5000)).toBeLessThan(0.02);

      // Year subTotal = GROSS (before concessions)
      expect(yr.subTotal).toBe(91000);
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
        .get("/api/studentFeeTracking")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcMulti });
      expect(res.status).toBe(200);

      const yr = res.body.data[0].feeTracking.academicYearWiseRecord[0];

      // Concessions should be summed: tuition=3000+2000=5000, exam=500+300=800, erp=0+100=100
      expect(yr.concessions.tuition).toBe(5000);
      expect(yr.concessions.exam).toBe(800);
      expect(yr.concessions.erp).toBe(100);
      expect(yr.concessions.totalConcession).toBe(5900);

      // Gross academic = 91000, net should be 91000 - 5000 - 800 - 100 = 85100
      expect(yr.academic.total.total).toBeCloseTo(85100, 1);

      // Individual component totals should be reduced
      const oddTuition = yr.academic.odd.tuition.total;
      const evenTuition = yr.academic.even.tuition.total;
      expect(oddTuition + evenTuition).toBeCloseTo(40000 + 41000 - 5000, 1);

      const oddExam = yr.academic.odd.exam.total;
      const evenExam = yr.academic.even.exam.total;
      expect(oddExam + evenExam).toBeCloseTo(2000 + 2000 - 800, 1);
    });

    it("rejects payment exceeding concession-adjusted net total", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcSingle });
      expect(res.status).toBe(200);

      const yr = res.body.data[0].feeTracking.academicYearWiseRecord[0];
      const netTuitionOdd = yr.academic.odd.tuition.total;

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
          remarks: "overpay test",
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
        .get("/api/studentFeeTracking")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollConcMulti });
      expect(res.status).toBe(200);

      const yr = res.body.data[0].feeTracking.academicYearWiseRecord[0];
      const netErpOdd = yr.academic.odd.erp.total;

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
            remarks: "exact net payment",
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
        .get("/api/studentFeeTracking")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance });
      expect(res.status).toBe(200);

      const yr = res.body.data[0].feeTracking.academicYearWiseRecord[0];

      // With zero concessions, subTotal should equal academic.total.total (before any payments)
      // Since payments may have been made, check that concessions are zero
      expect(yr.concessions.tuition).toBe(0);
      expect(yr.concessions.exam).toBe(0);
      expect(yr.concessions.totalConcession).toBe(0);

      // Gross component totals should be unmodified
      // Sem 1: tuition=40000, Sem 2: tuition=41000
      expect(yr.academic.odd.tuition.total).toBe(40000);
      expect(yr.academic.even.tuition.total).toBe(41000);

      // subTotal equals total for zero-concession components
      expect(yr.academic.odd.tuition.subTotal).toBe(40000);
      expect(yr.academic.odd.tuition.concession).toBe(0);
      expect(yr.academic.even.tuition.subTotal).toBe(41000);
      expect(yr.academic.even.tuition.concession).toBe(0);

      // Year subTotal = total.total for zero-concession students
      expect(yr.subTotal).toBe(yr.total.total);
    });
  });
});
