const {
  request, app, testCtx,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Transport
} = require("./setup");
const transportData = require("../api/fee-structure/transport/data.json");

describe("Transport Configuration API", () => {
  let createdTransportId = null;

  beforeAll(async () => {
    await globalSetup();
    await Transport.init(); // Ensure indexes are built 
  });

  afterAll(async () => {
    await globalTeardown();
  });

  describe("POST /api/transport", () => {
    it("creates a new flat transport stop (201)", async () => {
      const payload = {
        route: "Test Route 1",
        busNo: "T1",
        stop: "Library Stop",
        fee: 5000
      };

      const res = await request(app)
        .post("/api/transport")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.route).toBe("Test Route 1");
      expect(res.body.data.fee).toBe(5000);
      
      createdTransportId = res.body.data._id;
    });

    it("rejects duplicate stop on same route/bus (409)", async () => {
      await Transport.collection.createIndex({ route: 1, busNo: 1, stop: 1 }, { unique: true });

      const payload = {
        route: "Test Route 1",
        busNo: "T1",
        stop: "Library Stop",
        fee: 6000
      };

      await request(app)
        .post("/api/transport")
        .set(superadminAuth())
        .send(payload);

      const res = await request(app)
        .post("/api/transport")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(409);
    });

    it("rejects missing route name (400)", async () => {
      const payload = {
        busNo: "T1",
        stop: "Library Stop",
        fee: 5000
      };

      const res = await request(app)
        .post("/api/transport")
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/transport/bulk", () => {
    it("successfully unrolls and inserts nested JSON seed format (201)", async () => {
      // Small sample matching data.json structure
      const payloads = [
        {
          route: "Bulk Test Route",
          busNo: "B1",
          stops: [
            { name: "Stop A", fee: 1000 },
            { name: "Stop B", fee: 2000 }
          ]
        }
      ];

      const res = await request(app)
        .post("/api/transport/bulk")
        .set(superadminAuth())
        .send(payloads);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].stop).toBe("Stop A");
      expect(res.body.data[1].stop).toBe("Stop B");
      
      // Cleanup
      await Transport.deleteMany({ _id: { $in: res.body.data.map(d => d._id) } });
    });
    
    it("rejects badly formatted nested arrays (400)", async () => {
      const payloads = [
        {
          route: "Bulk Test Route",
          busNo: "B1",
          stops: [
            { name: "Stop A", fee: "NotANumber" } // Invalid type
          ]
        }
      ];

      const res = await request(app)
        .post("/api/transport/bulk")
        .set(superadminAuth())
        .send(payloads);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/transport", () => {
    it("retrieves all transport configurations (200)", async () => {
      const res = await request(app)
        .get("/api/transport")
        .set(adminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/transport/:id/fee", () => {
    it("updates only the fee (200)", async () => {
      const res = await request(app)
        .put(`/api/transport/${createdTransportId}/fee`)
        .set(superadminAuth())
        .send({ fee: 5500 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fee).toBe(5500);
      expect(res.body.data.route).toBe("Test Route 1"); 
    });
  });

  describe("PUT /api/transport/:id", () => {
    it("updates route and stop metadata (200)", async () => {
      const payload = {
        route: "Test Route 1 Modified",
        busNo: "T1",
        stop: "Library Stop Modified",
        fee: 5500
      };

      const res = await request(app)
        .put(`/api/transport/${createdTransportId}`)
        .set(superadminAuth())
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.route).toMatch(/Modified/);
    });
  });

  describe("DELETE /api/transport/:id", () => {
    it("deletes the transport configuration (200)", async () => {
      const temp = await Transport.create({ route: "DelRoute", busNo: "D1", stop: "DelStop", fee: 1000 });
      
      const res = await request(app)
        .delete(`/api/transport/${temp._id}`)
        .set(superadminAuth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const checkRes = await Transport.findById(temp._id);
      expect(checkRes).toBeNull();
    });
  });
});
