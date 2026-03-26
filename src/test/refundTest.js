const {
  request, app, testCtx,
  createFeeStructure, createStudent,
  globalSetup, globalTeardown,
  adminAuth,
  Student, StudentFeeTracking, StudentTransaction, FeeStructureMaster,
} = require("./setup");

const FeeRefund = require("../api/fee-payment/refund/model.refund");

describe("Refund API", () => {
  const rollNo = `24CS${testCtx.TS.slice(-3)}`;
  const year = testCtx.academicYearPrimary;

  beforeAll(async () => {
    await globalSetup();

    // Fee structure
    await createFeeStructure(year);

    // Student with both hostel and transport
    await createStudent(rollNo, {
      academicYear: year,
      hostel: { isApplicable: true, block: "B", sharing: 3, isAttached: false },
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
    });

    // Seed paid amounts: academic sem 1 (tuition + exam), hostel, transport
    const payRes = await request(app)
      .post("/api/feePayment/pay")
      .set(adminAuth())
      .send({
        rollNo,
        paymentType: "Cash",
        breakdowns: [
          {
            academicYear: year,
            academic: { semesterNumber: 1, tuition: 5000, exam: 1000, erp: 200, book: 300, lab: 500 },
          },
          {
            academicYear: year,
            hostel: 3000,
          },
          {
            academicYear: year,
            transport: 2000,
          },
        ],
      });
    expect(payRes.status).toBe(201);
  });

  afterAll(async () => {
    await Promise.all([
      FeeRefund.deleteMany({ rollNo }),
      StudentTransaction.deleteMany({ rollNo }),
      StudentFeeTracking.deleteMany({ rollNo }),
      Student.deleteMany({ "personal.rollNo": rollNo }),
      FeeStructureMaster.deleteMany({ academicYear: year }),
    ]);
    await globalTeardown();
  });

  /* ─── AUTH ──────────────────────────────────────────────────────── */

  it("rejects refund without auth token", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: 100, reason: "test" });
    expect(res.status).toBe(401);
  });

  /* ─── VALIDATION ERRORS ─────────────────────────────────────────── */

  it("rejects refund with missing academicYear", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ semNumber: 1, feeHead: "tuition", refundAmount: 100, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/academicYear/i);
  });

  it("rejects refund with invalid academicYear format", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: "2024", semNumber: 1, feeHead: "tuition", refundAmount: 100, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/academicYear/i);
  });

  it("rejects refund with missing feeHead", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, refundAmount: 100, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/feeHead/i);
  });

  it("rejects refund with invalid feeHead", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "insurance", refundAmount: 100, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/feeHead/i);
  });

  it("rejects academic refund without semNumber", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, feeHead: "tuition", refundAmount: 100, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/semNumber/i);
  });

  it("rejects refund with zero refundAmount", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: 0, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/refundAmount/i);
  });

  it("rejects refund with negative refundAmount", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: -500, reason: "test" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/refundAmount/i);
  });

  it("rejects refund with missing reason", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason/i);
  });

  it("rejects refund amount exceeding paid amount", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: 999999, reason: "test over limit" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds paid/i);
  });

  it("rejects refund for fee head with zero paid (book in sem 2 — never paid)", async () => {
    // Sem 2 (even) was never paid, so paid = 0
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 2, feeHead: "book", refundAmount: 100, reason: "nothing paid" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No paid amount/i);
  });

  /* ─── SUCCESS CASES ─────────────────────────────────────────────── */

  it("processes academic refund (tuition, sem 1) successfully", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "tuition", refundAmount: 500, reason: "Duplicate payment" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.rollNo).toBe(rollNo);
    expect(data.feeHead).toBe("tuition");
    expect(data.refundAmount).toBe(500);
    expect(data.refundReceiptNo).toMatch(/^RF-\d{4}-\d{5}$/);
    expect(data.semesterNumber).toBe(1);
    expect(data.academicYear).toBe(year);
    expect(data.status).toBe("completed");

    // Verify ledger: tuition.paid should have decreased
    const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();
    const yr = tracking.academicYearWiseRecord.find((r) => r.academicYear === year);
    expect(yr.academic.odd.tuition.paid).toBe(4500); // 5000 - 500
    // sem total should be recalculated
    const expectedSemPaid = 4500 + 1000 + 200 + 300 + 500;
    expect(yr.academic.odd.total.paid).toBe(expectedSemPaid);
  });

  it("processes hostel refund successfully", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, feeHead: "hostel", refundAmount: 1000, reason: "Fee waiver approved" });

    expect(res.status).toBe(201);
    expect(res.body.data.refundReceiptNo).toMatch(/^RF-\d{4}-\d{5}$/);
    expect(res.body.data.semesterNumber).toBeNull();

    const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();
    const yr = tracking.academicYearWiseRecord.find((r) => r.academicYear === year);
    expect(yr.hostel.total.paid).toBe(2000); // 3000 - 1000
  });

  it("processes transport refund successfully", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, feeHead: "transport", refundAmount: 500, reason: "Switched to hostel" });

    expect(res.status).toBe(201);
    expect(res.body.data.refundReceiptNo).toMatch(/^RF-\d{4}-\d{5}$/);
    expect(res.body.data.semesterNumber).toBeNull();

    const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();
    const yr = tracking.academicYearWiseRecord.find((r) => r.academicYear === year);
    expect(yr.transport.total.paid).toBe(1500); // 2000 - 500
  });

  it("processes transport refund with isActive=false and deactivates ledger", async () => {
    const before = await StudentFeeTracking.findOne({ rollNo }).lean();
    const beforeYear = before.academicYearWiseRecord.find((r) => r.academicYear === year);
    const beforeTransportTotal = beforeYear.transport.total.total;

    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({
        academicYear: year,
        feeHead: "transport",
        refundAmount: 200,
        reason: "Transport cancelled",
        isActive: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.ledgerIsActive).toBe(false);

    const tracking = await StudentFeeTracking.findOne({ rollNo }).lean();
    const yr = tracking.academicYearWiseRecord.find((r) => r.academicYear === year);

    expect(yr.transport.isActive).toBe(false);
    expect(yr.transport.endDate).toBeTruthy();
    expect(yr.transport.total.paid).toBe(1300); // 1500 - 200
  });

  it("refund receipt numbers are sequential (RF-YYYY-NNNNN)", async () => {
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "exam", refundAmount: 200, reason: "Partial refund" });

    expect(res.status).toBe(201);
    const receiptNo = res.body.data.refundReceiptNo;
    expect(receiptNo).toMatch(/^RF-\d{4}-\d{5}$/);
    const [, , seq] = receiptNo.split("-");
    expect(Number(seq)).toBeGreaterThan(0);
  });

  it("rejects second refund exceeding remaining paid balance", async () => {
    // exam paid was 1000, then 200 refunded → 800 remains; now try to refund 900
    const res = await request(app)
      .post(`/api/refund/${rollNo}`)
      .set(adminAuth())
      .send({ academicYear: year, semNumber: 1, feeHead: "exam", refundAmount: 900, reason: "Too much" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds paid/i);
  });

  /* ─── GET ENDPOINTS ─────────────────────────────────────────────── */

  it("GET /refund/student/:rollNo returns all refunds for student", async () => {
    const res = await request(app)
      .get(`/api/refund/student/${rollNo}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(4); // at least the 4 we created above
    expect(data[0].rollNo).toBe(rollNo);
    expect(data[0].refundReceiptNo).toMatch(/^RF-\d{4}-\d{5}$/);
  });

  it("GET /refund/student/:rollNo requires auth", async () => {
    const res = await request(app).get(`/api/refund/student/${rollNo}`);
    expect(res.status).toBe(401);
  });

  it("GET /refund/year/:academicYear returns paginated refunds for the year", async () => {
    const res = await request(app)
      .get(`/api/refund/year/${year}`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    const { refunds, pagination } = res.body.data;
    expect(Array.isArray(refunds)).toBe(true);
    expect(refunds.length).toBeGreaterThanOrEqual(4);
    expect(pagination).toMatchObject({ page: 1, limit: 20 });
  });

  it("GET /refund/year/:academicYear filters by feeHead", async () => {
    const res = await request(app)
      .get(`/api/refund/year/${year}?feeHead=hostel`)
      .set(adminAuth());

    expect(res.status).toBe(200);
    const { refunds } = res.body.data;
    expect(refunds.every((r) => r.feeHead === "hostel")).toBe(true);
  });

  it("GET /refund/report returns paginated report", async () => {
    const res = await request(app)
      .get("/api/refund/report")
      .set(adminAuth());

    expect(res.status).toBe(200);
    const { refunds, pagination } = res.body.data;
    expect(Array.isArray(refunds)).toBe(true);
    expect(typeof pagination.total).toBe("number");
  });

  it("GET /refund/report requires auth", async () => {
    const res = await request(app).get("/api/refund/report");
    expect(res.status).toBe(401);
  });

  it("GET /refund/year/:academicYear rejects invalid page param", async () => {
    const res = await request(app)
      .get(`/api/refund/year/${year}?page=abc`)
      .set(adminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/page/i);
  });
});
