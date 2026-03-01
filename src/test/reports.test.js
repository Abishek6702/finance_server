const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Reports & Enhanced Filter APIs", () => {
  beforeAll(async () => {
    await globalSetup();

    // Fee structure
    await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

    // Day-scholar student (no hostel, no transport)
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary }));

    // Hostel student
    await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(buildStudentPayload(testCtx.studentRollHostel, {
        academicYear: testCtx.academicYearPrimary,
        hostel: { isApplicable: true, block: "A", sharing: 3, isAttached: true },
      }));

    // Payment for day-scholar - Cash
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptOne,
        paymentType: "Cash",
        bankName: "Indian Bank",
        bankLocation: "Kinathukadavu",
        remarks: "test payment 1",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 1000, exam: 500, erp: 100, book: 100, lab: 100 },
        }],
      });

    // Second payment for day-scholar - UPI
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        receiptNo: testCtx.receiptTwo,
        paymentType: "UPI",
        remarks: "test payment 2",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 500 },
        }],
      });

    // Payment for hostel student
    await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollHostel,
        receiptNo: testCtx.receiptThree,
        paymentType: "DD",
        bankName: "SBI",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 200 },
          hostel: 1000,
        }],
      });
  });

  afterAll(async () => {
    for (const rollNo of [testCtx.studentRollFinance, testCtx.studentRollHostel]) {
      await StudentTransaction.deleteMany({ rollNo });
      await StudentFeeTracking.deleteMany({ rollNo });
      await Student.deleteMany({ "personal.rollNo": rollNo });
    }
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  /* ═══════════════════════════════════════════════════
     ENHANCED RECENT PAYMENTS FILTERS
  ═══════════════════════════════════════════════════ */

  describe("GET /api/feePayment/recent — enhanced filters", () => {
    it("filters by student name", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ name: "Jest" });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach(r => {
        expect(r.studentDetails.name.toLowerCase()).toContain("jest");
      });
    });

    it("filters by rollNo", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach(r => {
        expect(r.rollNo.toLowerCase()).toBe(testCtx.studentRollFinance.toLowerCase());
      });
    });

    it("filters by feeHead (tuition)", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ feeHead: "tuition" });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by feeHead (hostel)", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ feeHead: "hostel" });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by name + paymentMode combined", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ name: "Jest", paymentMode: "UPI" });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty for non-matching name filter", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ name: "ZzNonExistentZz" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("returns empty for non-matching rollNo filter", async () => {
      const res = await request(app)
        .get("/api/feePayment/recent")
        .set(adminAuth())
        .query({ rollNo: "99XX999" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  /* ═══════════════════════════════════════════════════
     ENHANCED FEE SUMMARY FILTERS
  ═══════════════════════════════════════════════════ */

  describe("GET /api/studentFeeTracking/summary — enhanced filters", () => {
    it("filters by rollNo", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, rollNo: testCtx.studentRollFinance });
      expect(res.status).toBe(200);
      const match = res.body.data.records.find(r => r.rollNo === testCtx.studentRollFinance);
      expect(match).toBeDefined();
      // Should not contain unrelated students
      res.body.data.records.forEach(r => {
        expect(r.rollNo.toLowerCase()).toContain(testCtx.studentRollFinance.slice(-3).toLowerCase());
      });
    });

    it("filters by student name", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, name: "Jest" });
      expect(res.status).toBe(200);
      res.body.data.records.forEach(r => {
        expect(r.studentDetails.name.toLowerCase()).toContain("jest");
      });
    });

    it("filters by department", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, department: "CSE" });
      expect(res.status).toBe(200);
      res.body.data.records.forEach(r => {
        expect(r.studentDetails.department.toLowerCase()).toBe("cse");
      });
    });

    it("filters by status (Partially Paid)", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, status: "Partially Paid" });
      expect(res.status).toBe(200);
      res.body.data.records.forEach(r => {
        expect(r.status).toBe("Partially Paid");
      });
    });

    it("filters by studentType (dayscholar)", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, studentType: "dayscholar" });
      expect(res.status).toBe(200);
      res.body.data.records.forEach(r => {
        expect(r.studentType.isDayScholar).toBe(true);
      });
    });

    it("filters by studentType (hosteler)", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, studentType: "hosteler" });
      expect(res.status).toBe(200);
      res.body.data.records.forEach(r => {
        expect(r.studentType.isHosteler).toBe(true);
      });
    });

    it("returns empty for non-matching name", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, name: "NobodyExists999" });
      expect(res.status).toBe(200);
      expect(res.body.data.records).toHaveLength(0);
    });

    it("combined filters (name + department)", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/summary")
        .set(adminAuth())
        .query({ year: testCtx.academicYearPrimary, name: "Jest", department: "CSE" });
      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ═══════════════════════════════════════════════════
     ENHANCED STUDENT FEE SUMMARY (overallTotals, studentType)
  ═══════════════════════════════════════════════════ */

  describe("GET /api/studentFeeTracking/summary/:rollNo — enhanced", () => {
    it("includes overallTotals in response", async () => {
      const res = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.overallTotals).toBeDefined();
      expect(res.body.data.overallTotals.demand).toBeGreaterThan(0);
      expect(res.body.data.overallTotals.paid).toBeGreaterThan(0);
      expect(res.body.data.overallTotals.overdue).toBeGreaterThan(0);
      expect(["Paid", "Partially Paid", "Unpaid"]).toContain(res.body.data.overallTotals.status);
    });

    it("overallTotals has correct fields", async () => {
      const res = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const totals = res.body.data.overallTotals;
      expect(typeof totals.demand).toBe("number");
      expect(typeof totals.concession).toBe("number");
      expect(typeof totals.paid).toBe("number");
      expect(typeof totals.fine).toBe("number");
      expect(typeof totals.overdue).toBe("number");
      expect(typeof totals.status).toBe("string");
    });

    it("feeSummaryRecords include studentType per year", async () => {
      const res = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollHostel}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const yr = res.body.data.feeSummaryRecords.find(r => r.academicYear === testCtx.academicYearPrimary);
      expect(yr).toBeDefined();
      expect(yr.studentType).toBeDefined();
      expect(yr.studentType.isHosteler).toBe(true);
      expect(yr.studentType.isDayScholar).toBe(false);
    });

    it("day-scholar feeSummaryRecords show isDayScholar true", async () => {
      const res = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const yr = res.body.data.feeSummaryRecords.find(r => r.academicYear === testCtx.academicYearPrimary);
      expect(yr.studentType.isDayScholar).toBe(true);
      expect(yr.studentType.isHosteler).toBe(false);
    });

    it("overallTotals status is Partially Paid after partial payment", async () => {
      const res = await request(app)
        .get(`/api/studentFeeTracking/summary/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.overallTotals.status).toBe("Partially Paid");
    });
  });

  /* ═══════════════════════════════════════════════════
     ENHANCED STUDENTS FOR FILTER (rollNo filter)
  ═══════════════════════════════════════════════════ */

  describe("GET /api/studentFeeTracking/students — rollNo filter", () => {
    it("filters students by rollNo", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/students")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].rollNo).toBe(testCtx.studentRollFinance);
    });

    it("filters students by partial rollNo", async () => {
      const suffix = testCtx.studentRollFinance.slice(-3);
      const res = await request(app)
        .get("/api/studentFeeTracking/students")
        .set(adminAuth())
        .query({ rollNo: suffix });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty for non-matching rollNo", async () => {
      const res = await request(app)
        .get("/api/studentFeeTracking/students")
        .set(adminAuth())
        .query({ rollNo: "99ZZ999" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  /* ═══════════════════════════════════════════════════
     STUDENT REPORT
  ═══════════════════════════════════════════════════ */

  describe("GET /api/feePayment/reports/student/:rollNo", () => {
    it("returns student report with receipts", async () => {
      const res = await request(app)
        .get(`/api/feePayment/reports/student/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.student).toBeDefined();
      expect(res.body.data.student.rollNo).toBe(testCtx.studentRollFinance);
      expect(res.body.data.student.name).toBe("Jest Tester");
      expect(res.body.data.student.department).toBe("CSE");
      expect(res.body.data.receipts.length).toBeGreaterThanOrEqual(2);
    });

    it("receipt contains correct shape", async () => {
      const res = await request(app)
        .get(`/api/feePayment/reports/student/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const receipt = res.body.data.receipts[0];
      expect(receipt.receiptNo).toBeDefined();
      expect(receipt.academicYear).toBeDefined();
      expect(receipt.paymentMode).toBeDefined();
      expect(receipt.totalAmount).toBeGreaterThan(0);
      expect(Array.isArray(receipt.feeBreakdown)).toBe(true);
    });

    it("receipt feeBreakdown has feeHead, subHead, demand, paid, balance", async () => {
      const res = await request(app)
        .get(`/api/feePayment/reports/student/${testCtx.studentRollFinance}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const receipt = res.body.data.receipts.find(r => r.receiptNo === testCtx.receiptOne);
      expect(receipt).toBeDefined();
      expect(receipt.feeBreakdown.length).toBeGreaterThanOrEqual(1);
      const row = receipt.feeBreakdown[0];
      expect(row).toHaveProperty("feeHead");
      expect(row).toHaveProperty("subHead");
      expect(row).toHaveProperty("demand");
      expect(row).toHaveProperty("paid");
      expect(row).toHaveProperty("balance");
    });

    it("hostel student report includes hostel fee row", async () => {
      const res = await request(app)
        .get(`/api/feePayment/reports/student/${testCtx.studentRollHostel}`)
        .set(adminAuth());
      expect(res.status).toBe(200);
      const receipt = res.body.data.receipts.find(r => r.receiptNo === testCtx.receiptThree);
      expect(receipt).toBeDefined();
      const hostelRow = receipt.feeBreakdown.find(f => f.feeHead === "Hostel");
      expect(hostelRow).toBeDefined();
      expect(hostelRow.paid).toBe(1000);
    });

    it("returns 404 for unknown student", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/student/90XX900")
        .set(adminAuth());
      expect(res.status).toBe(404);
    });

    it("rejects without auth", async () => {
      const res = await request(app)
        .get(`/api/feePayment/reports/student/${testCtx.studentRollFinance}`);
      expect(res.status).toBe(401);
    });
  });

  /* ═══════════════════════════════════════════════════
     DATE-WISE REPORT
  ═══════════════════════════════════════════════════ */

  describe("GET /api/feePayment/reports/datewise", () => {
    it("returns date-wise report without filters", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("rows have expected shape", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth());
      expect(res.status).toBe(200);
      const row = res.body.data[0];
      expect(row).toHaveProperty("rollNo");
      expect(row).toHaveProperty("studentName");
      expect(row).toHaveProperty("department");
      expect(row).toHaveProperty("academicYear");
      expect(row).toHaveProperty("feeHead");
      expect(row).toHaveProperty("amount");
      expect(row).toHaveProperty("date");
      expect(row).toHaveProperty("paymentMode");
      expect(row).toHaveProperty("receiptNo");
    });

    it("filters by academicYear", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth())
        .query({ academicYear: testCtx.academicYearPrimary });
      expect(res.status).toBe(200);
      res.body.data.forEach(row => {
        expect(row.academicYear).toBe(testCtx.academicYearPrimary);
      });
    });

    it("filters by date range", async () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString();
      const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth())
        .query({ fromDate: from, toDate: to });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by limit", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth())
        .query({ limit: 2 });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it("returns empty for future date range", async () => {
      const res = await request(app)
        .get("/api/feePayment/reports/datewise")
        .set(adminAuth())
        .query({ fromDate: "2090-01-01", toDate: "2090-12-31" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("rejects without auth", async () => {
      const res = await request(app).get("/api/feePayment/reports/datewise");
      expect(res.status).toBe(401);
    });
  });
});
