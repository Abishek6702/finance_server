const {
  request,
  app,
  testCtx,
  globalSetup,
  globalTeardown,
  superadminAuth,
  adminAuth,
  buildFeeStructurePayload,
  FeeStructureMaster,
} = require("./setup");

const buildSemesters = ({ startTuition = 41000 } = {}) =>
  Array.from({ length: 8 }, (_, idx) => ({
    semesterNumber: idx + 1,
    tuition: { fee: startTuition + idx * 500 },
    exam: { fee: 2000 },
    erp: { fee: 500 },
    book: { fee: 1000 },
    lab: { fee: 1500 },
    isActive: true,
  }));

describe("Acadamic Fee Structure API", () => {
  const startYear = parseInt(testCtx.academicYearPrimary.split("-")[0], 10) + 30;
  const baseYear = `${startYear}-${startYear + 1}`;
  const secondYear = `${startYear + 1}-${startYear + 2}`;

  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    await FeeStructureMaster.deleteMany({ academicYear: { $in: [baseYear, secondYear] } });
    await globalTeardown();
  });

  it("denies admin access for academic fee structure routes", async () => {
    const res = await request(app)
      .get("/api/feeStructureMaster")
      .set(adminAuth());

    expect([401, 403]).toContain(res.status);
  });

  it("creates fee structure with edge semesters used for update-merge coverage", async () => {
    const payload = buildFeeStructurePayload(baseYear);
    const semesters = payload.academicStructures[0].departments[0].semesters;

    delete semesters[0].tuition;

    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.academicYear).toBe(baseYear);
  });

  it("rejects duplicate academic year", async () => {
    const res = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(baseYear));

    expect(res.status).toBe(409);
  });

  it("gets all and gets by year with active filtering", async () => {
    const getAllRes = await request(app)
      .get("/api/feeStructureMaster")
      .set(superadminAuth());

    expect(getAllRes.status).toBe(200);
    expect(Array.isArray(getAllRes.body.data)).toBe(true);

    const getYearRes = await request(app)
      .get(`/api/feeStructureMaster/${baseYear}`)
      .set(superadminAuth());

    expect(getYearRes.status).toBe(200);
    expect(getYearRes.body.data.academicYear).toBe(baseYear);
  });

  it("returns empty structures for non-matching filters", async () => {
    const res = await request(app)
      .get(`/api/feeStructureMaster/${baseYear}?quota=Management%20Quota`)
      .set(superadminAuth());

    expect(res.status).toBe(200);
    expect(res.body.data.academicStructures).toHaveLength(0);
  });

  it("updates existing structure and exercises nested merge branches", async () => {
    const res = await request(app)
      .put(`/api/feeStructureMaster/${baseYear}`)
      .set(superadminAuth())
      .send({
        academicYear: baseYear,
        academicStructures: [
          {
            quota: "Government Quota",
            educationType: "UG",
            degreeProgram: "BE",
            departments: [
              {
                departmentName: "CSE",
                semesters: buildSemesters({ startTuition: 46000 }),
                isActive: true,
              },
            ],
            isActive: true,
          },
          {
            quota: "Management Quota",
            educationType: "UG",
            degreeProgram: "BTech",
            departments: [
              {
                departmentName: "IT",
                semesters: buildSemesters({ startTuition: 52000 }),
                isActive: true,
              },
            ],
            isActive: true,
          },
        ],
      });

    expect(res.status).toBe(200);

    const doc = await FeeStructureMaster.findOne({ academicYear: baseYear }).lean();
    const govStruct = doc.academicStructures.find(
      (s) =>
        s.quota === "Government Quota" &&
        s.educationType === "UG" &&
        s.degreeProgram === "BE"
    );

    expect(govStruct).toBeTruthy();
    expect(govStruct.departments[0].semesters.some((s) => s.semesterNumber === 8)).toBe(true);

    const sem1 = govStruct.departments[0].semesters.find((s) => s.semesterNumber === 1);
    expect(sem1.tuition.fee).toBe(46000);

    const mgmtStruct = doc.academicStructures.find(
      (s) =>
        s.quota === "Management Quota" &&
        s.educationType === "UG" &&
        s.degreeProgram === "BTech"
    );
    expect(mgmtStruct).toBeTruthy();
    expect(mgmtStruct.departments[0].departmentName).toBe("IT");
  });

  it("deactivates matching nested structure via filtered delete", async () => {
    const res = await request(app)
      .delete(
        `/api/feeStructureMaster/${baseYear}?quota=Management%20Quota&educationType=UG&degreeProgram=BTech`
      )
      .set(superadminAuth());

    expect(res.status).toBe(200);

    const filteredGetRes = await request(app)
      .get(`/api/feeStructureMaster/${baseYear}?quota=Management%20Quota&educationType=UG&degreeProgram=BTech`)
      .set(superadminAuth());

    expect(filteredGetRes.status).toBe(200);
    expect(filteredGetRes.body.data.academicStructures).toHaveLength(0);
  });

  it("validates delete query dependencies", async () => {
    const onlyDegreeRes = await request(app)
      .delete(`/api/feeStructureMaster/${baseYear}?degreeProgram=BE`)
      .set(superadminAuth());
    expect(onlyDegreeRes.status).toBe(400);

    const onlyEduRes = await request(app)
      .delete(`/api/feeStructureMaster/${baseYear}?educationType=UG`)
      .set(superadminAuth());
    expect(onlyEduRes.status).toBe(400);
  });

  it("returns 404 when filtered delete has no match", async () => {
    const res = await request(app)
      .delete(
        `/api/feeStructureMaster/${baseYear}?quota=Management%20Quota&educationType=UG&degreeProgram=ME`
      )
      .set(superadminAuth());

    expect(res.status).toBe(404);
  });

  it("returns 404 for update/get on unknown year", async () => {
    const unknownYear = `${startYear + 40}-${startYear + 41}`;

    const updateRes = await request(app)
      .put(`/api/feeStructureMaster/${unknownYear}`)
      .set(superadminAuth())
      .send(buildFeeStructurePayload(unknownYear));
    expect(updateRes.status).toBe(404);

    const getRes = await request(app)
      .get(`/api/feeStructureMaster/${unknownYear}`)
      .set(superadminAuth());
    expect(getRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/feeStructureMaster/${unknownYear}`)
      .set(superadminAuth());
    expect(deleteRes.status).toBe(404);
  });

  it("deletes whole year by deactivating root and then returns 404 on get", async () => {
    const createSecondYearRes = await request(app)
      .post("/api/feeStructureMaster")
      .set(superadminAuth())
      .send(buildFeeStructurePayload(secondYear));
    expect(createSecondYearRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/feeStructureMaster/${secondYear}`)
      .set(superadminAuth());
    expect(deleteRes.status).toBe(200);

    const getDeletedRes = await request(app)
      .get(`/api/feeStructureMaster/${secondYear}`)
      .set(superadminAuth());
    expect(getDeletedRes.status).toBe(404);
  });
});
