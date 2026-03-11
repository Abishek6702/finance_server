const {
  request, app, testCtx, login,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
} = require("./setup");

describe("Auth API", () => {
  beforeAll(globalSetup);
  afterAll(globalTeardown);

  /* ─── LOGIN ────────────────────────────────────────── */

  it("logs in superadmin and returns token in body", async () => {
    const res = await login("superadmin@sece.ac.in", "superadmin@123");
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("superadmin");
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.email).toBe("superadmin@sece.ac.in");
  });

  it("logs in admin and returns correct role", async () => {
    const res = await login("admin@sece.ac.in", "admin@123");
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("admin");
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.name).toBeDefined();
  });

  it("rejects login for wrong password (401)", async () => {
    const res = await login("admin@sece.ac.in", "wrong-password");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid password");
  });

  it("rejects login for unknown user (404)", async () => {
    const res = await login(`unknown${testCtx.TS}@sece.ac.in`, "some-password");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  it("rejects login when email is missing (400)", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "admin@123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("rejects login when password is missing (400)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "admin@sece.ac.in" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("rejects login when both email and password are missing (400)", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("rejects login with empty string email (400)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "", password: "admin@123" });
    expect(res.status).toBe(400);
  });

  it("rejects login with empty string password (400)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "admin@sece.ac.in", password: "" });
    expect(res.status).toBe(400);
  });

  /* ─── LOGOUT ───────────────────────────────────────── */

  it("rejects logout without token (401)", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it("rejects logout with malformed token (401)", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", "Bearer bad.token.value");
    expect(res.status).toBe(401);
  });

  it("rejects logout with missing Bearer prefix (401)", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", testCtx.superadminToken);
    expect(res.status).toBe(401);
  });

  it("logs out successfully with valid token", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${testCtx.superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  /* ─── AUTHORIZATION GUARDS ─────────────────────────── */

  it("blocks superadmin-only routes for admin (fee structure create)", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(adminAuth())
      .send({ academicYear: "9999-10000" });
    expect(res.status).toBe(401);
  });

  it("blocks superadmin-only routes for admin (student create)", async () => {
    const res = await request(app)
      .post("/api/studentsManagement")
      .set(adminAuth())
      .send({});
    expect(res.status).toBe(401);
  });

  it("blocks protected route without token", async () => {
    const res = await request(app).get("/api/feeStructureMaster");
    expect(res.status).toBe(401);
  });

  it("blocks protected route with expired/invalid JWT", async () => {
    const res = await request(app)
      .get("/api/feeStructureMaster")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1MDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.invalid");
    expect(res.status).toBe(401);
  });

  /* ─── 404 CATCH-ALL ────────────────────────────────── */

  it("returns 404 for unknown endpoint", async () => {
    const res = await request(app).get("/api/non-existent-endpoint");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found");
  });

  it("returns 404 for unknown POST endpoint", async () => {
    const res = await request(app).post("/api/non-existent").send({});
    expect(res.status).toBe(404);
  });
});
