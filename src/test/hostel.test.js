const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, FeeStructureMaster, Hostel,
  TS,
} = require("./setup");

describe("Hostel API", () => {
  /**
   * Every block×sharing×isAttached combination (48 total) is seeded.
   * We'll temporarily delete a known combo to test add/bulk, then
   * restore it in afterAll.
   */
  const TEMP_DELETE_COMBO = { block: "F", sharing: 5, isAttached: false };
  const TEMP_DELETE_COMBO2 = { block: "F", sharing: 5, isAttached: true };
  let deletedRecord, deletedRecord2;
  let addedHostelIds = [];

  beforeAll(async () => {
    await globalSetup();

    // Remove two combos so we can test add / bulk
    deletedRecord = await Hostel.findOneAndDelete(TEMP_DELETE_COMBO);
    deletedRecord2 = await Hostel.findOneAndDelete(TEMP_DELETE_COMBO2);
  });

  afterAll(async () => {
    // Clean test-created records
    for (const id of addedHostelIds) {
      await Hostel.findOneAndDelete({ id });
    }
    // Restore deleted seed records
    if (deletedRecord) {
      await Hostel.create({
        id: deletedRecord.id,
        block: deletedRecord.block,
        sharing: deletedRecord.sharing,
        isAttached: deletedRecord.isAttached,
        fee: deletedRecord.fee,
      });
    }
    if (deletedRecord2) {
      await Hostel.create({
        id: deletedRecord2.id,
        block: deletedRecord2.block,
        sharing: deletedRecord2.sharing,
        isAttached: deletedRecord2.isAttached,
        fee: deletedRecord2.fee,
      });
    }
    await globalTeardown();
  });

  /* ─── READ APIs ───── */

  it("returns full mapping (GET /)", async () => {
    const res = await request(app).get("/api/hostel");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length) {
      expect(res.body.data[0]).toHaveProperty("block");
      expect(res.body.data[0]).toHaveProperty("roomTypes");
      expect(Array.isArray(res.body.data[0].roomTypes)).toBe(true);
      if (res.body.data[0].roomTypes.length) {
        expect(res.body.data[0].roomTypes[0]).toHaveProperty("sharing");
        expect(res.body.data[0].roomTypes[0]).toHaveProperty("fee");
      }
    }
  });

  /* ─── BLOCKS ───── */

  it("returns blocks without filters", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({});
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns blocks filtered by sharing", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({ sharing: 2 });
    expect(res.status).toBe(200);
  });

  it("returns blocks filtered by isAttached", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({ isAttached: true });
    expect(res.status).toBe(200);
  });

  it("rejects blocks with invalid sharing", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({ sharing: 7 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sharing/i);
  });

  it("rejects blocks with non-number sharing", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({ sharing: "two" });
    expect(res.status).toBe(400);
  });

  it("rejects blocks with non-boolean isAttached", async () => {
    const res = await request(app).post("/api/hostel/blocks").send({ isAttached: "yes" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isAttached.*boolean/i);
  });

  /* ─── ROOM TYPES ───── */

  it("returns roomTypes without filter", async () => {
    const res = await request(app).post("/api/hostel/roomTypes").send({});
    expect(res.status).toBe(200);
  });

  it("returns roomTypes for block A", async () => {
    const res = await request(app).post("/api/hostel/roomTypes").send({ block: "A" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects roomTypes with non-string block", async () => {
    const res = await request(app).post("/api/hostel/roomTypes").send({ block: 123 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/block.*string/i);
  });

  it("rejects roomTypes with empty block", async () => {
    const res = await request(app).post("/api/hostel/roomTypes").send({ block: "   " });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/block.*empty/i);
  });

  /* ─── FEES ───── */

  it("rejects fees without filters", async () => {
    const res = await request(app).post("/api/hostel/fees").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one/i);
  });

  it("returns fees by block", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ block: "A" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns fees by sharing", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ sharing: 3 });
    expect(res.status).toBe(200);
  });

  it("returns fees by isAttached", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ isAttached: false });
    expect(res.status).toBe(200);
  });

  it("returns fees by block + sharing + isAttached", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ block: "A", sharing: 2, isAttached: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fee).toBe(80000);
  });

  it("rejects fees with non-string block", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ block: true });
    expect(res.status).toBe(400);
  });

  it("rejects fees with empty block", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ block: "  " });
    expect(res.status).toBe(400);
  });

  it("rejects fees with invalid sharing", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ sharing: 6 });
    expect(res.status).toBe(400);
  });

  it("rejects fees with non-boolean isAttached", async () => {
    const res = await request(app).post("/api/hostel/fees").send({ isAttached: 1 });
    expect(res.status).toBe(400);
  });

  /* ─── ADD SINGLE HOSTEL ───── */

  it("rejects add hostel without auth", async () => {
    const res = await request(app).post("/api/hostel/add").send({
      block: "F", sharing: 5, isAttached: false, fee: 50000,
    });
    expect(res.status).toBe(401);
  });

  it("rejects add hostel with missing block", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ sharing: 2, isAttached: true, fee: 50000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/block/i);
  });

  it("rejects add hostel with missing sharing", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", isAttached: true, fee: 50000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sharing/i);
  });

  it("rejects add hostel with invalid sharing (6)", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 6, isAttached: true, fee: 50000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sharing/i);
  });

  it("rejects add hostel with missing isAttached", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, fee: 50000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isAttached/i);
  });

  it("rejects add hostel with non-boolean isAttached", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, isAttached: "yes", fee: 50000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isAttached/i);
  });

  it("rejects add hostel with missing fee", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, isAttached: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fee/i);
  });

  it("rejects add hostel with negative fee", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, isAttached: true, fee: -100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fee/i);
  });

  it("rejects add hostel with non-numeric fee", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, isAttached: true, fee: "abc" });
    expect(res.status).toBe(400);
  });

  it("rejects add hostel with empty block string", async () => {
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "   ", sharing: 2, isAttached: true, fee: 5000 });
    expect(res.status).toBe(400);
  });

  it("adds single hostel successfully (201) – uses freed combo", async () => {
    // We deleted F/5/false in beforeAll, so we can add it back
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "F", sharing: 5, isAttached: false, fee: 99000 });
    expect(res.status).toBe(201);
    expect(res.body.data.block).toBe("F");
    expect(res.body.data.sharing).toBe(5);
    expect(res.body.data.isAttached).toBe(false);
    expect(res.body.data.fee).toBe(99000);
    addedHostelIds.push(res.body.data.id);
  });

  it("rejects duplicate hostel add (409)", async () => {
    // F/5/false was just added above
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "F", sharing: 5, isAttached: false, fee: 99000 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects adding existing seeded combo (409)", async () => {
    // A/2/true already exists in seed
    const res = await request(app)
      .post("/api/hostel/add")
      .set(adminAuth())
      .send({ block: "A", sharing: 2, isAttached: true, fee: 80000 });
    expect(res.status).toBe(409);
  });

  /* ─── BULK ADD HOSTEL ───── */

  it("rejects bulk add with empty records", async () => {
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({ records: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/records/i);
  });

  it("rejects bulk add when records is not array", async () => {
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({ records: "not" });
    expect(res.status).toBe(400);
  });

  it("rejects bulk add with invalid record (missing fee)", async () => {
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({ records: [{ block: "A", sharing: 2, isAttached: true }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/records\[0\].*fee/i);
  });

  it("rejects bulk add with invalid sharing in record", async () => {
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({ records: [{ block: "A", sharing: 7, isAttached: true, fee: 5000 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/records\[0\].*sharing/i);
  });

  it("bulk adds hostel (1 valid) → 201", async () => {
    // F/5/true was also deleted in beforeAll
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({
        records: [
          { block: "F", sharing: 5, isAttached: true, fee: 88000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.failed).toHaveLength(0);
    expect(res.body.data.summary.created).toBe(1);
    res.body.data.created.forEach(c => addedHostelIds.push(c.id));
  });

  it("bulk add with 1 duplicate → 207", async () => {
    const res = await request(app)
      .post("/api/hostel/bulk")
      .set(adminAuth())
      .send({
        records: [
          { block: "F", sharing: 5, isAttached: true, fee: 88000 }, // dup: just added above
        ],
      });
    expect(res.status).toBe(207);
    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].reason).toMatch(/duplicate|already exists/i);
  });

  /* ─── UPDATE HOSTEL ───── */

  it("rejects update with no fields", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one/i);
  });

  it("rejects update with negative fee", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ fee: -500 });
    expect(res.status).toBe(400);
  });

  it("rejects update with invalid sharing", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ sharing: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects update with non-boolean isAttached", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ isAttached: "true" });
    expect(res.status).toBe(400);
  });

  it("rejects update with empty block", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ block: "  " });
    expect(res.status).toBe(400);
  });

  it("rejects update with non-string block", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 2, isAttached: true });
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ block: 999 });
    expect(res.status).toBe(400);
  });

  it("updates hostel fee (200)", async () => {
    const existing = await Hostel.findOne({ block: "A", sharing: 3, isAttached: false });
    const originalFee = existing.fee;
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ fee: 77777 });
    expect(res.status).toBe(200);
    expect(res.body.data.hostel.fee).toBe(77777);
    // Restore original fee
    await Hostel.findOneAndUpdate({ id: existing.id }, { fee: originalFee });
  });

  it("updates hostel fee=0 (free hostel)", async () => {
    const existing = await Hostel.findOne({ block: "B", sharing: 4, isAttached: true });
    const originalFee = existing.fee;
    const res = await request(app)
      .put(`/api/hostel/${existing.id}`)
      .set(adminAuth())
      .send({ fee: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.hostel.fee).toBe(0);
    // Restore
    await Hostel.findOneAndUpdate({ id: existing.id }, { fee: originalFee });
  });

  it("returns 404 for non-existent hostel ID", async () => {
    const res = await request(app)
      .put("/api/hostel/H999")
      .set(adminAuth())
      .send({ fee: 1000 });
    expect(res.status).toBe(404);
  });

  /* ─── HOSTEL FEE PROPAGATION ───── */

  it("propagates hostel fee update to student tracking", async () => {
    // Create fee structure
    await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

    // Create student with hostel
    const studentPayload = buildStudentPayload(testCtx.studentRollHostel, {
      academicYear: testCtx.academicYearPrimary,
      hostel: { isApplicable: true, block: "A", sharing: 2, isAttached: true },
    });
    const studentRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(studentPayload);

    if (studentRes.status === 201) {
      // Get the tracking to find hostel ID
      const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
      const yr = tracking?.academicYearWiseRecord?.find(r => r.academicYear === testCtx.academicYearPrimary);
      const hostelId = yr?.hostel?.hostel;

      if (hostelId) {
        const beforeFee = yr.hostel.subTotal;
        const newFee = beforeFee + 5000;

        // Update hostel fee → should propagate
        const updateRes = await request(app)
          .put(`/api/hostel/${hostelId}`)
          .set(adminAuth())
          .send({ fee: newFee });
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.data.trackingRecordsUpdated).toBeGreaterThanOrEqual(1);

        // Verify propagation
        const updatedTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollHostel });
        const updatedYr = updatedTracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
        expect(updatedYr.hostel.subTotal).toBe(newFee);

        // Restore original fee
        await request(app)
          .put(`/api/hostel/${hostelId}`)
          .set(adminAuth())
          .send({ fee: beforeFee });
      }

      // Cleanup
      await Student.deleteMany({ "personal.rollNo": testCtx.studentRollHostel });
      await StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollHostel });
    }
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
  });
});
