const {
  request, app, testCtx,
  buildFlatRow, toCSVBuffer, toXLSXBuffer, CSV_HEADERS,
  buildFeeStructurePayload,
  createFeeStructure,
  globalSetup, globalTeardown,
  superadminAuth, adminAuth,
  Student, StudentFeeTracking, FeeStructureMaster,
  TS,
} = require("./setup");

describe("Students Bulk Import / Update API", () => {
  beforeAll(async () => {
    await globalSetup();
    await createFeeStructure(testCtx.academicYearPrimary);
  });

  afterAll(async () => {
    // Cleanup any residual bulk students
    for (const rollNo of [testCtx.bulkRollA, testCtx.bulkRollB, testCtx.bulkRollC, `20CS${TS.slice(-3)}`, `21CS${TS.slice(-3)}`, `22CS${TS.slice(-3)}`]) {
      await StudentFeeTracking.deleteMany({ rollNo });
      await Student.deleteMany({ "personal.rollNo": rollNo });
    }
    await FeeStructureMaster.deleteMany({ academicYear: testCtx.academicYearPrimary });
    await globalTeardown();
  });

  /* ========== BULK CREATE ========== */

  it("rejects bulk create without file", async () => {
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });

  it("rejects empty CSV file", async () => {
    const emptyCSV = Buffer.from(CSV_HEADERS.join(",") + "\n");
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", emptyCSV, "empty.csv");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty|no data/i);
  });

  it("rejects bulk create for admin role", async () => {
    const csvBuf = toCSVBuffer([buildFlatRow(testCtx.bulkRollA)]);
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(adminAuth())
      .attach("file", csvBuf, "students.csv");
    expect(res.status).toBe(401);
  });

  it("bulk creates students from CSV (2 valid rows)", async () => {
    const csvBuf = toCSVBuffer([
      buildFlatRow(testCtx.bulkRollA),
      buildFlatRow(testCtx.bulkRollB),
    ]);
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "students.csv");

    expect(res.status).toBe(201);
    expect(res.body.data.summary.total).toBe(2);
    expect(res.body.data.summary.created).toBe(2);
    expect(res.body.data.summary.failed).toBe(0);
    expect(res.body.data.created).toHaveLength(2);

    const studentA = await Student.findOne({ "personal.rollNo": testCtx.bulkRollA });
    const studentB = await Student.findOne({ "personal.rollNo": testCtx.bulkRollB });
    expect(studentA).toBeTruthy();
    expect(studentB).toBeTruthy();

    const trackingA = await StudentFeeTracking.findOne({ rollNo: testCtx.bulkRollA });
    expect(trackingA).toBeTruthy();
  });

  it("bulk create from XLSX with 1 valid + 1 duplicate → 207 multi-status", async () => {
    const xlsxBuf = toXLSXBuffer([
      buildFlatRow(testCtx.bulkRollC),
      buildFlatRow(testCtx.bulkRollA), // already exists
    ]);
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", xlsxBuf, "students.xlsx");

    expect(res.status).toBe(207);
    expect(res.body.data.summary.created).toBe(1);
    expect(res.body.data.summary.failed).toBe(1);
    expect(res.body.data.failed[0].rollNo).toBe(testCtx.bulkRollA);
    expect(res.body.data.failed[0].reason).toMatch(/already exists/i);
  });

  it("handles CSV with null / missing columns gracefully", async () => {
    const minimalHeaders = ["rollNo", "degreeProgram", "batch", "currentAcademicYear"];
    const line = [`20CS${TS.slice(-3)}`, "BE", testCtx.academicYearPrimary, testCtx.academicYearPrimary].join(",");
    const csvBuf = Buffer.from(minimalHeaders.join(",") + "\n" + line, "utf-8");

    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "minimal.csv");

    // Must NOT crash (500) – expect 201 or 207
    expect([201, 207]).toContain(res.status);
    expect(res.body.data.summary).toBeDefined();

    await StudentFeeTracking.deleteMany({ rollNo: `20CS${TS.slice(-3)}` });
    await Student.deleteMany({ "personal.rollNo": `20CS${TS.slice(-3)}` });
  });

  it("handles CSV with misaligned / extra columns", async () => {
    const header = "extraCol,rollNo,unknownField,degreeProgram,batch,currentAcademicYear,anotherExtra";
    const row = `foo,21CS${TS.slice(-3)},bar,BE,${testCtx.academicYearPrimary},${testCtx.academicYearPrimary},baz`;
    const csvBuf = Buffer.from(header + "\n" + row, "utf-8");

    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "misaligned.csv");

    expect([201, 207]).toContain(res.status);
    expect(res.body.data.summary).toBeDefined();

    await StudentFeeTracking.deleteMany({ rollNo: `21CS${TS.slice(-3)}` });
    await Student.deleteMany({ "personal.rollNo": `21CS${TS.slice(-3)}` });
  });

  it("bulk create CSV with transport-enabled rows", async () => {
    const csvBuf = toCSVBuffer([
      buildFlatRow(`22CS${TS.slice(-3)}`, {
        transportApplicable: "TRUE",
        transportRoute: "Bharathiyar University",
        transportStop: "Kinathukadavu",
      }),
    ]);
    const res = await request(app)
      .post("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "transport-enabled.csv");

    expect([201, 207]).toContain(res.status);

    await StudentFeeTracking.deleteMany({ rollNo: `22CS${TS.slice(-3)}` });
    await Student.deleteMany({ "personal.rollNo": `22CS${TS.slice(-3)}` });
  });

  /* ========== BULK UPDATE ========== */

  it("rejects bulk update without file", async () => {
    const res = await request(app)
      .put("/api/studentsManagement/bulk")
      .set(superadminAuth());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });

  it("rejects bulk update for admin role", async () => {
    const csvBuf = toCSVBuffer([buildFlatRow(testCtx.bulkRollA, { studentName: "Updated" })]);
    const res = await request(app)
      .put("/api/studentsManagement/bulk")
      .set(adminAuth())
      .attach("file", csvBuf, "update.csv");
    expect(res.status).toBe(401);
  });

  it("bulk updates students from CSV", async () => {
    const csvBuf = toCSVBuffer([
      buildFlatRow(testCtx.bulkRollA, { studentName: "Updated A" }),
      buildFlatRow(testCtx.bulkRollB, { studentName: "Updated B" }),
    ]);
    const res = await request(app)
      .put("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "update.csv");

    expect(res.status).toBe(200);
    expect(res.body.data.summary.updated).toBe(2);
    expect(res.body.data.summary.failed).toBe(0);

    const a = await Student.findOne({ "personal.rollNo": testCtx.bulkRollA });
    const b = await Student.findOne({ "personal.rollNo": testCtx.bulkRollB });
    expect(a.personal.studentName).toBe("Updated A");
    expect(b.personal.studentName).toBe("Updated B");
  });

  it("bulk update from XLSX with valid + not-found → 207", async () => {
    const xlsxBuf = toXLSXBuffer([
      buildFlatRow(testCtx.bulkRollC, { studentName: "Updated C" }),
      buildFlatRow("99CS999", { studentName: "Ghost" }),
    ]);
    const res = await request(app)
      .put("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", xlsxBuf, "update.xlsx");

    expect(res.status).toBe(207);
    expect(res.body.data.summary.updated).toBe(1);
    expect(res.body.data.summary.failed).toBe(1);
    expect(res.body.data.failed[0].rollNo).toBe("99CS999");
    expect(res.body.data.failed[0].reason).toMatch(/not found/i);
  });

  it("bulk update handles rows missing rollNo", async () => {
    const csvBuf = toCSVBuffer([buildFlatRow("", { studentName: "No Roll" })]);
    const res = await request(app)
      .put("/api/studentsManagement/bulk")
      .set(superadminAuth())
      .attach("file", csvBuf, "noroll.csv");

    expect(res.status).toBe(207);
    expect(res.body.data.summary.failed).toBe(1);
    expect(res.body.data.failed[0].reason).toMatch(/rollNo.*required/i);
  });

  /* ========== BULK CLEANUP ========== */

  it("deletes bulk-created students", async () => {
    for (const rollNo of [testCtx.bulkRollA, testCtx.bulkRollB, testCtx.bulkRollC]) {
      const res = await request(app)
        .delete(`/api/studentsManagement/${rollNo}`)
        .set(superadminAuth());
      expect(res.status).toBe(200);
    }
  });
});
