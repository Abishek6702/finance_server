const {
  request, app, testCtx,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Hostel
} = require("./setup");

describe("Hostel Configuration API", () => {
  let createdHostelId = null;

  beforeAll(async () => {
    await globalSetup();
    await Hostel.createIndexes(); // Ensure indexes are built before testing 409s (autoIndex:false skips init)
  });

  afterAll(async () => {
    // Rely on global teardown to clear the DB cleanly instead of tracking single IDs manually
    await globalTeardown();
  });

  describe("POST /api/hostel", () => {
    it("creates a new hostel configuration (201)", async () => {
      // Delete the globally seeded config so we have room to test creation
      await Hostel.findOneAndDelete({ block: "A", sharing: 2, isAttached: true });

      const payload = {
        block: "A",
        sharing: 2,
        isAttached: true,
        fee: 90000
      };

      const res = await request(app)
        .post("/api/hostel")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.block).toBe("A");
      expect(res.body.data.fee).toBe(90000);
      
      createdHostelId = res.body.data._id;
    });

    it("rejects duplicate configuration (409)", async () => {
      // "A-2-true" now exists from the previous block. This should be rejected.
      const payload = {
        block: "A",
        sharing: 2,
        isAttached: true,
        fee: 95000
      };
      
      const res = await request(app)
        .post("/api/hostel")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(409);
    });

    it("rejects invalid block name (400)", async () => {
      const payload = {
        block: "Z",
        sharing: 2,
        isAttached: true,
        fee: 95000
      };

      const res = await request(app)
        .post("/api/hostel")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(400);
    });
    
    it("requires superadmin privileges (401/403)", async () => {
       const res = await request(app)
        .post("/api/hostel")
        .set(adminAuth())
        .send({ block: "B", sharing: 2, isAttached: true, fee: 80000 });
       expect([401, 403]).toContain(res.status); // Depending on auth middleware logic, both are valid denials
    });
  });

  describe("POST /api/hostel/bulk", () => {
    it("successfully inserts multiple valid configurations", async () => {
      // These combos exist in the seed — clear them first so we can test a clean insert
      await Hostel.deleteMany({
        $or: [
          { block: "E", sharing: 3, isAttached: false },
          { block: "E", sharing: 4, isAttached: true }
        ]
      });

      const payloads = [
        { block: "E", sharing: 3, isAttached: false, fee: 65000 },
        { block: "E", sharing: 4, isAttached: true, fee: 60000 }
      ];

      const res = await request(app)
        .post("/api/hostel/bulk")
        .set(superadminAuth())
        .send(payloads);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      
      // Cleanup
      await Hostel.deleteMany({ _id: { $in: res.body.data.map(d => d._id) } });
    });
    
    it("rejects non-array payloads (400)", async () => {
       const res = await request(app)
        .post("/api/hostel/bulk")
        .set(superadminAuth())
        .send({ block: "F", sharing: 2, isAttached: true, fee: 65000 });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/hostel", () => {
    it("retrieves all hostel configurations (200)", async () => {
      const res = await request(app)
        .get("/api/hostel")
        .set(adminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/hostel/:id/fee", () => {
    it("updates only the fee (200)", async () => {
      const res = await request(app)
        .put(`/api/hostel/${createdHostelId}/fee`)
        .set(superadminAuth())
        .send({ fee: 92000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fee).toBe(92000);
      expect(res.body.data.block).toBe("A"); // Ensure other fields remain
    });
    
    it("rejects invalid fee type (400)", async () => {
       const res = await request(app)
        .put(`/api/hostel/${createdHostelId}/fee`)
        .set(superadminAuth())
        .send({ fee: "92000" });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/hostel/:id", () => {
    it("updates block and sharing metadata (200)", async () => {
      // B-2-true is already seeded — clear it so the update won't conflict
      await Hostel.findOneAndDelete({ block: "B", sharing: 2, isAttached: true });

      const payload = {
        block: "B",
        sharing: 2,
        isAttached: true,
        fee: 92000
      };

      const res = await request(app)
        .put(`/api/hostel/${createdHostelId}`)
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.block).toBe("B");
    });
  });

  describe("DELETE /api/hostel/:id", () => {
    it("deletes the hostel configuration (200)", async () => {
      // F-5-true is already seeded — clear it so we can create a fresh record to delete
      await Hostel.findOneAndDelete({ block: "F", sharing: 5, isAttached: true });
      const temp = await Hostel.create({ block: "F", sharing: 5, isAttached: true, fee: 99000 });
      
      const res = await request(app)
        .delete(`/api/hostel/${temp._id}`)
        .set(superadminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const checkRes = await Hostel.findById(temp._id);
      expect(checkRes).toBeNull();
    });

    it("returns 404 for already deleted or non-existent configuration", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const res = await request(app)
        .delete(`/api/hostel/${fakeId}`)
        .set(superadminAuth());

      expect(res.status).toBe(404);
    });
  });
});
