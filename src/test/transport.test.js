const {
  request, app, testCtx,
  buildFeeStructurePayload, buildStudentPayload,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, FeeStructureMaster, Transport,
  TS,
} = require("./setup");

describe("Transport API", () => {
  let addedTransportIds = [];

  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    for (const id of addedTransportIds) {
      await Transport.findByIdAndDelete(id);
    }
    await globalTeardown();
  });

  /* ─── EXISTING READ APIs ───── */

  it("returns full mapping (GET /)", async () => {
    const res = await request(app).get("/api/transport");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length) {
      expect(res.body.data[0]).toHaveProperty("route");
      expect(res.body.data[0]).toHaveProperty("busNo");
      expect(res.body.data[0]).toHaveProperty("stops");
    }
  });

  /* ─── STOPS ───── */

  it("returns stops without filters", async () => {
    const res = await request(app).post("/api/transport/stops").send({});
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns stops by route", async () => {
    const res = await request(app).post("/api/transport/stops").send({ route: "Bharathiyar University" });
    expect(res.status).toBe(200);
  });

  it("rejects stops route non-string", async () => {
    const res = await request(app).post("/api/transport/stops").send({ route: 123 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/route.*string/i);
  });

  it("rejects stops empty route string", async () => {
    const res = await request(app).post("/api/transport/stops").send({ route: "   " });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/route.*empty/i);
  });

  /* ─── BUSES ───── */

  it("rejects buses when stop missing", async () => {
    const res = await request(app).post("/api/transport/buses").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stop.*required/i);
  });

  it("rejects buses for blank stop", async () => {
    const res = await request(app).post("/api/transport/buses").send({ stop: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects buses for non-string stop", async () => {
    const res = await request(app).post("/api/transport/buses").send({ stop: 42 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stop.*string/i);
  });

  it("returns buses for valid stop", async () => {
    const res = await request(app).post("/api/transport/buses").send({ stop: "Kinathukadavu" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  /* ─── FEES ───── */

  it("rejects fees without filters", async () => {
    const res = await request(app).post("/api/transport/fees").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one/i);
  });

  it("rejects fees with non-string busNo", async () => {
    const res = await request(app).post("/api/transport/fees").send({ busNo: 9 });
    expect(res.status).toBe(400);
  });

  it("rejects fees with empty busNo", async () => {
    const res = await request(app).post("/api/transport/fees").send({ busNo: "  " });
    expect(res.status).toBe(400);
  });

  it("rejects fees with non-string stop", async () => {
    const res = await request(app).post("/api/transport/fees").send({ stop: true });
    expect(res.status).toBe(400);
  });

  it("returns fees by busNo", async () => {
    const res = await request(app).post("/api/transport/fees").send({ busNo: "1" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns fees by stop", async () => {
    const res = await request(app).post("/api/transport/fees").send({ stop: "Kinathukadavu" });
    expect(res.status).toBe(200);
  });

  it("returns fees by busNo and stop", async () => {
    const res = await request(app).post("/api/transport/fees").send({ busNo: "1", stop: "Kinathukadavu" });
    expect(res.status).toBe(200);
  });

  /* ─── ADD SINGLE TRANSPORT ───── */

  it("rejects add transport without auth", async () => {
    const res = await request(app).post("/api/transport/add").send({
      route: "Test Route", busNo: "T1", stop: "TestStop", fee: 5000,
    });
    expect(res.status).toBe(401);
  });

  it("rejects add transport with missing route", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ busNo: "T1", stop: "TestStop", fee: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/route/i);
  });

  it("rejects add transport with missing busNo", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "Test Route", stop: "TestStop", fee: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/busNo/i);
  });

  it("rejects add transport with missing stop", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "Test Route", busNo: "T1", fee: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stop/i);
  });

  it("rejects add transport with missing fee", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "Test Route", busNo: "T1", stop: "TestStop" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fee/i);
  });

  it("rejects add transport with negative fee", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "Test Route", busNo: "T1", stop: "TestStop", fee: -100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fee/i);
  });

  it("rejects add transport with non-numeric fee", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "Test Route", busNo: "T1", stop: "TestStop", fee: "five" });
    expect(res.status).toBe(400);
  });

  it("rejects add transport with empty route string", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: "   ", busNo: "T1", stop: "TestStop", fee: 5000 });
    expect(res.status).toBe(400);
  });

  it("adds single transport successfully (201)", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: `TestRoute${TS}`, busNo: `T${TS.slice(-3)}`, stop: `TestStop${TS}`, fee: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.data.route).toBe(`TestRoute${TS}`);
    expect(res.body.data.fee).toBe(5000);
    addedTransportIds.push(res.body.data._id);
  });

  it("rejects duplicate transport add (409)", async () => {
    const res = await request(app)
      .post("/api/transport/add")
      .set(adminAuth())
      .send({ route: `TestRoute${TS}`, busNo: `T${TS.slice(-3)}`, stop: `TestStop${TS}`, fee: 5000 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  /* ─── BULK ADD TRANSPORT ───── */

  it("rejects bulk add with empty records", async () => {
    const res = await request(app)
      .post("/api/transport/bulk")
      .set(adminAuth())
      .send({ records: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/records/i);
  });

  it("rejects bulk add when records is not array", async () => {
    const res = await request(app)
      .post("/api/transport/bulk")
      .set(adminAuth())
      .send({ records: "not-array" });
    expect(res.status).toBe(400);
  });

  it("rejects bulk add with invalid record (missing fee)", async () => {
    const res = await request(app)
      .post("/api/transport/bulk")
      .set(adminAuth())
      .send({ records: [{ route: "R1", busNo: "B1", stop: "S1" }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/records\[0\].*fee/i);
  });

  it("bulk adds transport (2 valid) → 201", async () => {
    const res = await request(app)
      .post("/api/transport/bulk")
      .set(adminAuth())
      .send({
        records: [
          { route: `BulkR${TS}`, busNo: `B${TS.slice(-3)}`, stop: `BS1${TS}`, fee: 3000 },
          { route: `BulkR${TS}`, busNo: `B${TS.slice(-3)}`, stop: `BS2${TS}`, fee: 4000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.failed).toHaveLength(0);
    res.body.data.created.forEach(c => addedTransportIds.push(c.id));
  });

  it("bulk add with 1 valid + 1 duplicate → 207", async () => {
    const res = await request(app)
      .post("/api/transport/bulk")
      .set(adminAuth())
      .send({
        records: [
          { route: `BulkR2${TS}`, busNo: `B2${TS.slice(-3)}`, stop: `BS3${TS}`, fee: 2000 },
          { route: `BulkR${TS}`, busNo: `B${TS.slice(-3)}`, stop: `BS1${TS}`, fee: 3000 }, // duplicate
        ],
      });
    expect(res.status).toBe(207);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].reason).toMatch(/duplicate|already exists/i);
    res.body.data.created.forEach(c => addedTransportIds.push(c.id));
  });

  /* ─── UPDATE TRANSPORT ───── */

  it("rejects update with no fields", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one/i);
  });

  it("rejects update with negative fee", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ fee: -500 });
    expect(res.status).toBe(400);
  });

  it("rejects update with empty route", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ route: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects update with non-string busNo", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ busNo: 123 });
    expect(res.status).toBe(400);
  });

  it("updates transport fee (200)", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ fee: 6000 });
    expect(res.status).toBe(200);
    expect(res.body.data.transport.fee).toBe(6000);
  });

  it("updates transport route only (200)", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ route: `UpdatedRoute${TS}` });
    expect(res.status).toBe(200);
    expect(res.body.data.transport.route).toBe(`UpdatedRoute${TS}`);
  });

  it("returns 404 when updating non-existent transport ID", async () => {
    const res = await request(app)
      .put("/api/transport/000000000000000000000000")
      .set(adminAuth())
      .send({ fee: 1000 });
    expect(res.status).toBe(404);
  });

  it("updates transport with fee=0 (free transport)", async () => {
    const id = addedTransportIds[0];
    const res = await request(app)
      .put(`/api/transport/${id}`)
      .set(adminAuth())
      .send({ fee: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.transport.fee).toBe(0);
  });

  /* ─── TRANSPORT FEE PROPAGATION ───── */

  it("propagates transport fee update to student tracking", async () => {
    // Create fee structure
    const fsRes = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(testCtx.academicYearPrimary));

    // Create student with transport
    const studentPayload = buildStudentPayload(testCtx.studentRollTransport, {
      academicYear: testCtx.academicYearPrimary,
      transport: { isApplicable: true, route: "Bharathiyar University", stopName: "Kinathukadavu" },
    });
    const studentRes = await request(app)
      .post("/api/studentsManagement")
      .set(superadminAuth())
      .send(studentPayload);

    if (studentRes.status === 201) {
      // Get the tracking to find transport ID
      const tracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollTransport });
      const yr = tracking?.academicYearWiseRecord?.find(r => r.academicYear === testCtx.academicYearPrimary);
      const transportId = yr?.transport?.transport;

      if (transportId) {
        // Read current transport fee so we use a DIFFERENT value
        const transportDoc = await Transport.findById(transportId);
        const originalFee = transportDoc.fee;
        const newFee = originalFee === 12345 ? 54321 : 12345;

        // Update transport fee → should propagate
        const updateRes = await request(app)
          .put(`/api/transport/${transportId}`)
          .set(adminAuth())
          .send({ fee: newFee });
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.data.trackingRecordsUpdated).toBeGreaterThanOrEqual(1);

        // Verify propagation
        const updatedTracking = await StudentFeeTracking.findOne({ rollNo: testCtx.studentRollTransport });
        const updatedYr = updatedTracking.academicYearWiseRecord.find(r => r.academicYear === testCtx.academicYearPrimary);
        expect(updatedYr.transport.subTotal).toBe(newFee);

        // Restore original transport fee
        await Transport.findByIdAndUpdate(transportId, { fee: originalFee });
      }

      // Cleanup
      await Student.deleteMany({ "personal.rollNo": testCtx.studentRollTransport });
      await StudentFeeTracking.deleteMany({ rollNo: testCtx.studentRollTransport });
    }
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
  });
});
