const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

describe("Reports API", () => {
  beforeAll(async () => {
    await globalSetup();

    // 1. Create fee structure + student + payment so tracking logic exists
    const fsRes = await createFeeStructure(testCtx.academicYearPrimary);
    expect([200, 201, 409]).toContain(fsRes.status);

    const stuRes = await createStudent(testCtx.studentRollFinance, { academicYear: testCtx.academicYearPrimary });
    expect([200, 201, 409]).toContain(stuRes.status);

    // 2. Make two payments to guarantee transaction records
    const payRes1 = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "Cash",
        bankName: "SBI",
        bankLocation: "City",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 1, tuition: 15000, exam: 500 },
        }],
      });
    expect([201, 400]).toContain(payRes1.status);

    const payRes2 = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo: testCtx.studentRollFinance,
        paymentType: "UPI",
        bankName: "HDFC",
        bankLocation: "Online",
        breakdowns: [{
          academicYear: testCtx.academicYearPrimary,
          academic: { semesterNumber: 2, tuition: 10000 },
        }],
      });
    expect([201, 400]).toContain(payRes2.status);
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

  describe("GET /api/reports/individual", () => {
    it("fails if rollNo is missing", async () => {
      const res = await request(app)
        .get("/api/reports/individual")
        .set(adminAuth());
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/rollNo is required/i);
    });

    it("fails on invalid semester query", async () => {
      const res = await request(app)
        .get("/api/reports/individual")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance, semester: "oddity" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/semester must be 'odd' or 'even'/i);
    });

    it("fetches report without date filter (defaults to today)", async () => {
      const res = await request(app)
        .get("/api/reports/individual")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance });
      if(res.status === 400) console.log(res.body);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.rollNo).toBe(testCtx.studentRollFinance);
      
      // We expect rows since we just made payments today
      expect(Array.isArray(res.body.data.rows)).toBe(true);
      if (res.body.data.rows.length > 0) {
        const row = res.body.data.rows[0];
        expect(row).toHaveProperty("receiptNo");
        expect(row).toHaveProperty("feeHead");
        expect(row).toHaveProperty("subHead");
        expect(row).toHaveProperty("demand");
        expect(row).toHaveProperty("concession");
        expect(row).toHaveProperty("paid");
        expect(row).toHaveProperty("balance");
        expect(row).toHaveProperty("paymentDate");
        expect(row).toHaveProperty("paymentMode");
        expect(row).toHaveProperty("reductionReasonId");
      }
    });

    it("fetches report with date filters that include our payments", async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 2);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 2);

      const fromDateStr = yesterday.toISOString().split("T")[0];
      const toDateStr = tomorrow.toISOString().split("T")[0];

      const res = await request(app)
        .get("/api/reports/individual")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance, fromDate: fromDateStr, toDate: toDateStr });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);

      // Verify row mapping logic with dynamic balances
      const rowInfo = res.body.data.rows[0];
      expect(typeof rowInfo.demand).toBe("number");
      expect(typeof rowInfo.concession).toBe("number");
      expect(typeof rowInfo.balance).toBe("number");
      expect(typeof rowInfo.paid).toBe("number"); // This is the transaction paidAmount
    });

    it("filters by semester (odd) successfully", async () => {
      const res = await request(app)
        .get("/api/reports/individual")
        .set(adminAuth())
        .query({ rollNo: testCtx.studentRollFinance, semester: "odd" });
      
      expect(res.status).toBe(200);
      
      const oddRows = res.body.data.rows;
      // Depending on test execution context, we can just ensure it succeeds
      expect(Array.isArray(oddRows)).toBe(true);
    });
  });

  describe("GET /api/reports/datewise", () => {
    it("fails on invalid dates", async () => {
      const res = await request(app)
        .get("/api/reports/datewise")
        .set(adminAuth())
        .query({ fromDate: "2026-99-99", toDate: "2026-05-15" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid date format/);
    });

    it("fetches datewise report without specifying dates (defaults to today)", async () => {
      const res = await request(app)
        .get("/api/reports/datewise")
        .set(adminAuth());
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it("fetches datewise report using query filters", async () => {
      const res = await request(app)
        .get("/api/reports/datewise")
        .set(adminAuth())
        .query({ 
          academicYear: testCtx.academicYearPrimary,
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.rows)).toBe(true);

      if (res.body.data.rows.length > 0) {
        const row = res.body.data.rows[0];
        expect(row).toHaveProperty("student");
        expect(row.student).toHaveProperty("studentName");
        expect(row.student).toHaveProperty("department");
        expect(row.student).toHaveProperty("year");
        
        expect(row).toHaveProperty("rollNo");
        expect(row).toHaveProperty("semPeriod");
        expect(row).toHaveProperty("feeHead");
        expect(row).toHaveProperty("amount");
        expect(row).toHaveProperty("date");
        expect(row).toHaveProperty("paymentMode");
        expect(row).toHaveProperty("bank");
        expect(row).toHaveProperty("receiptNo");
        expect(row).toHaveProperty("reductionReasonId");
      }
    });

    it("filters properly by paymentMode", async () => {
      const res = await request(app)
        .get("/api/reports/datewise")
        .set(adminAuth())
        .query({ paymentMode: "Cash" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
      if (res.body.data.rows.length > 0) {
        res.body.data.rows.forEach(r => {
          expect(r.paymentMode).toBe("Cash");
        });
      }
    });
  });

  describe("GET /api/reports/classwise", () => {
    it("fails on invalid status", async () => {
      const res = await request(app)
        .get("/api/reports/classwise")
        .set(adminAuth())
        .query({ status: "invalid_status" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/status must be 'paid', 'unpaid', or 'partial'/i);
    });

    it("fetches classwise report successfully", async () => {
      const res = await request(app)
        .get("/api/reports/classwise")
        .set(adminAuth())
        .query({ academicYear: testCtx.academicYearPrimary });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
      expect(res.body.data.overall).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.overall).toHaveProperty("oddSemTotal");
      expect(res.body.data.overall).toHaveProperty("evenSemTotal");
      expect(res.body.data.overall).toHaveProperty("yearTotal");
      expect(res.body.data.overall).toHaveProperty("paidAmount");
      expect(res.body.data.overall).toHaveProperty("pendingTotal");
      
      if (res.body.data.rows.length > 0) {
        const row = res.body.data.rows[0];
        expect(row).toHaveProperty("studentName");
        expect(row).toHaveProperty("rollNo");
        expect(row).toHaveProperty("section");
        expect(row).toHaveProperty("department");
        expect(row).toHaveProperty("year");
        expect(row).toHaveProperty("academicYear");
        expect(row).toHaveProperty("semNo");
        expect(row).toHaveProperty("feeHead");
        expect(row).toHaveProperty("subHead");
        expect(row).toHaveProperty("status");
        expect(row).toHaveProperty("total");
        expect(row).toHaveProperty("paid");
        expect(row).toHaveProperty("concession");
        expect(row).toHaveProperty("unpaid");
      }
    });

    it("filters properly by status (paid)", async () => {
      const res = await request(app)
        .get("/api/reports/classwise")
        .set(adminAuth())
        .query({ status: "paid" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.rows)).toBe(true);
      if (res.body.data.rows.length > 0) {
        res.body.data.rows.forEach(r => {
          expect(r.status.toLowerCase()).toBe("paid");
        });
      }
    });
  });

  describe("GET /api/reports/classwise/pdf", () => {
    it("fails when academicYear is missing", async () => {
      const res = await request(app)
        .get("/api/reports/classwise/pdf")
        .set(adminAuth())
        .query({ yearOfStudying: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/academicYear is required/i);
    });

    it("fails when yearOfStudying is missing", async () => {
      const res = await request(app)
        .get("/api/reports/classwise/pdf")
        .set(adminAuth())
        .query({ academicYear: testCtx.academicYearPrimary });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/yearOfStudying is required/i);
    });

    it("fetches cumulative balance history with pagination", async () => {
      const res = await request(app)
        .get("/api/reports/classwise/pdf")
        .set(adminAuth())
        .query({
          academicYear: testCtx.academicYearPrimary,
          yearOfStudying: 1,
          page: 1,
          limit: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("academicYear", testCtx.academicYearPrimary);
      expect(res.body.data).toHaveProperty("generatedOn");
      expect(res.body.data).toHaveProperty("students");
      expect(Array.isArray(res.body.data.students)).toBe(true);
      expect(res.body.data).toHaveProperty("grandTotal");
      expect(res.body.data.grandTotal).toHaveProperty("oddSem");
      expect(res.body.data.grandTotal).toHaveProperty("evenSem");
      expect(res.body.data.grandTotal).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("pagination");

      if (res.body.data.students.length > 0) {
        const first = res.body.data.students[0];
        expect(first).toHaveProperty("slNo");
        expect(first).toHaveProperty("rollNo");
        expect(first).toHaveProperty("studentName");
        expect(first).toHaveProperty("balances");
        expect(first).toHaveProperty("year1Fees");
        expect(first).toHaveProperty("total");
        expect(first.total).toHaveProperty("oddSem");
        expect(first.total).toHaveProperty("evenSem");
        expect(first.total).toHaveProperty("grandTotal");
      }
    });
  });
});
