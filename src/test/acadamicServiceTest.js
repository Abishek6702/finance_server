const loadServiceWithMocks = () => {
  jest.resetModules();

  const mockFeeStructureMaster = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  const mockStudent = {
    find: jest.fn(),
  };

  const mockTrackingSync = {
    upsertTrackingRowsForStudent: jest.fn(),
  };

  const mockMongoose = {
    startSession: jest.fn(),
  };

  jest.doMock("../api/fee-structure/acadamic/modelAcadamic", () => mockFeeStructureMaster);
  jest.doMock("../api/student/students-management/modelStudent", () => mockStudent);
  jest.doMock(
    "../api/fee-payment/student-fee-tracking/serviceTrackingSyncInternal",
    () => mockTrackingSync
  );
  jest.doMock("mongoose", () => mockMongoose);

  const service = require("../api/fee-structure/acadamic/serviceAcadamic");

  return {
    service,
    mockFeeStructureMaster,
    mockStudent,
    mockTrackingSync,
    mockMongoose,
  };
};

describe("Acadamic Service Internal Branch Coverage", () => {
  it("covers default query args and filter branches in read methods", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    mockFeeStructureMaster.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { academicYear: "3000-3001", isActive: true },
        {
          academicYear: "3001-3002",
          isActive: true,
          academicStructures: [
            {
              quota: "Government Quota",
              educationType: "UG",
              degreeProgram: "BE",
              isActive: true,
            },
          ],
        },
        {
          academicYear: "3002-3003",
          isActive: true,
          academicStructures: [
            {
              quota: "Government Quota",
              educationType: "UG",
              degreeProgram: "BE",
              isActive: true,
              departments: [{ departmentName: "CSE", isActive: true }],
            },
          ],
        },
      ]),
    });

    const all = await service.getFeeStructures();
    expect(all.length).toBeGreaterThan(0);

    const mismatchEdu = await service.getFeeStructures({
      quota: "Government Quota",
      educationType: "PG",
    });
    expect(Array.isArray(mismatchEdu)).toBe(true);

    const mismatchDegree = await service.getFeeStructures({
      quota: "Government Quota",
      educationType: "UG",
      degreeProgram: "ME",
    });
    expect(Array.isArray(mismatchDegree)).toBe(true);

    mockFeeStructureMaster.findOne.mockResolvedValue({
      academicYear: "3003-3004",
      isActive: true,
      academicStructures: [],
      toObject() {
        return this;
      },
    });

    const byYear = await service.getFeeStructureByYear("3003-3004");
    expect(byYear.academicYear).toBe("3003-3004");
  });

  it("covers update branches when optional nested blocks are omitted", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const existingDoc = {
      academicYear: "3010-3011",
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
          isActive: true,
          departments: [
            {
              departmentName: "CSE",
              isActive: true,
              semesters: [
                {
                  semesterNumber: 1,
                  tuition: { fee: 40000 },
                  exam: { fee: 2000 },
                  erp: { fee: 500 },
                  book: { fee: 1000 },
                  lab: { fee: 1500 },
                  isActive: true,
                },
              ],
            },
          ],
        },
      ],
      isActive: true,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          academicYear: this.academicYear,
          academicStructures: this.academicStructures,
          isActive: this.isActive,
        };
      },
    };

    mockFeeStructureMaster.findOne.mockResolvedValue(existingDoc);

    const noStructUpdate = await service.updateFeeStructure("3010-3011", { isActive: false });
    expect(noStructUpdate.feeStructure.isActive).toBe(false);

    await service.updateFeeStructure("3010-3011", {
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
        },
      ],
    });

    await service.updateFeeStructure("3010-3011", {
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
          departments: [
            {
              departmentName: "CSE",
            },
          ],
        },
      ],
    });

    await service.updateFeeStructure("3010-3011", {
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
          departments: [
            {
              departmentName: "CSE",
              semesters: [
                {
                  semesterNumber: 1,
                  tuition: { fee: 40500 },
                },
              ],
            },
          ],
        },
      ],
      isActive: true,
    });

    expect(existingDoc.markModified).toHaveBeenCalledWith("academicStructures");
    expect(existingDoc.save).toHaveBeenCalled();
  });

  it("filters plain objects correctly in getFeeStructures", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const docs = [
      {
        academicYear: "2099-2100",
        isActive: true,
        academicStructures: [
          {
            quota: "Government Quota",
            educationType: "UG",
            degreeProgram: "BE",
            isActive: true,
            departments: [
              {
                departmentName: "CSE",
                isActive: true,
                semesters: [
                  { semesterNumber: 1, isActive: true },
                  { semesterNumber: 2, isActive: false },
                ],
              },
              {
                departmentName: "IT",
                isActive: false,
                semesters: [{ semesterNumber: 1, isActive: true }],
              },
            ],
          },
          {
            quota: "Management Quota",
            educationType: "PG",
            degreeProgram: "ME",
            isActive: true,
            departments: [],
          },
          {
            quota: "Government Quota",
            educationType: "UG",
            degreeProgram: "BE",
            isActive: false,
            departments: [],
          },
        ],
      },
    ];

    mockFeeStructureMaster.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(docs),
    });

    const result = await service.getFeeStructures({
      quota: "Government Quota",
      educationType: "UG",
      degreeProgram: "BE",
    });

    expect(result).toHaveLength(1);
    expect(result[0].academicStructures).toHaveLength(1);
    expect(result[0].academicStructures[0].departments).toHaveLength(1);
    expect(result[0].academicStructures[0].departments[0].semesters).toHaveLength(1);
  });

  it("throws not found or inactive from getFeeStructureByYear after filter", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    mockFeeStructureMaster.findOne.mockResolvedValue({
      academicYear: "2098-2099",
      isActive: false,
      academicStructures: [],
      toObject() {
        return this;
      },
    });

    await expect(service.getFeeStructureByYear("2098-2099", {})).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("creates fee structure and syncs tracking rows for matching students", async () => {
    const {
      service,
      mockFeeStructureMaster,
      mockStudent,
      mockTrackingSync,
      mockMongoose,
    } = loadServiceWithMocks();

    const createdDoc = { _id: "f1", academicYear: "2094-2095" };
    const endSession = jest.fn().mockResolvedValue(undefined);
    const withTransaction = jest.fn().mockImplementation(async (cb) => cb());

    mockFeeStructureMaster.findOne.mockResolvedValue(null);
    mockFeeStructureMaster.create.mockResolvedValue([createdDoc]);
    mockStudent.find.mockReturnValue({
      session: jest.fn().mockResolvedValue([{ personal: { rollNo: "25CS001" } }]),
    });
    mockMongoose.startSession.mockResolvedValue({ withTransaction, endSession });
    mockTrackingSync.upsertTrackingRowsForStudent.mockResolvedValue(undefined);

    const result = await service.createFeeStructure({
      academicYear: "2094-2095",
      academicStructures: [],
    });

    expect(result).toBe(createdDoc);
    expect(mockTrackingSync.upsertTrackingRowsForStudent).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it("rethrows transaction error in create and always ends session", async () => {
    const {
      service,
      mockFeeStructureMaster,
      mockMongoose,
    } = loadServiceWithMocks();

    const endSession = jest.fn().mockResolvedValue(undefined);
    const withTransaction = jest.fn().mockImplementation(async () => {
      throw new Error("tx failure");
    });

    mockFeeStructureMaster.findOne.mockResolvedValue(null);
    mockMongoose.startSession.mockResolvedValue({ withTransaction, endSession });

    await expect(
      service.createFeeStructure({ academicYear: "2095-2096", academicStructures: [] })
    ).rejects.toThrow("tx failure");

    expect(mockMongoose.startSession).toHaveBeenCalledTimes(1);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it("covers nested update branches for new structure, department, semester and missing fee component", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const existingDoc = {
      academicYear: "2090-2091",
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
          isActive: true,
          departments: [
            {
              departmentName: "CSE",
              isActive: true,
              semesters: [
                {
                  semesterNumber: 1,
                  exam: { fee: 2000 },
                  erp: { fee: 500 },
                  book: { fee: 1000 },
                  lab: { fee: 1500 },
                  isActive: true,
                },
              ],
            },
          ],
        },
      ],
      isActive: true,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          academicYear: this.academicYear,
          academicStructures: this.academicStructures,
          isActive: this.isActive,
        };
      },
    };

    mockFeeStructureMaster.findOne.mockResolvedValue(existingDoc);

    const res = await service.updateFeeStructure("2090-2091", {
      academicYear: "2090-2091",
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "UG",
          degreeProgram: "BE",
          departments: [
            {
              departmentName: "CSE",
              isActive: true,
              semesters: [
                {
                  semesterNumber: 1,
                  tuition: { fee: 45000 },
                  isActive: true,
                },
                {
                  semesterNumber: 2,
                  tuition: { fee: 46000 },
                  exam: { fee: 2000 },
                  erp: { fee: 500 },
                  book: { fee: 1000 },
                  lab: { fee: 1500 },
                  isActive: true,
                },
              ],
            },
            {
              departmentName: "IT",
              isActive: true,
              semesters: [
                {
                  semesterNumber: 1,
                  tuition: { fee: 48000 },
                  exam: { fee: 2000 },
                  erp: { fee: 500 },
                  book: { fee: 1000 },
                  lab: { fee: 1500 },
                  isActive: true,
                },
              ],
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
              departmentName: "AIML",
              semesters: [
                {
                  semesterNumber: 1,
                  tuition: { fee: 52000 },
                  exam: { fee: 2000 },
                  erp: { fee: 500 },
                  book: { fee: 1000 },
                  lab: { fee: 1500 },
                  isActive: true,
                },
              ],
              isActive: true,
            },
          ],
          isActive: true,
        },
      ],
      isActive: true,
    });

    expect(res.feeStructure.academicStructures.length).toBe(2);

    const govStruct = existingDoc.academicStructures.find(
      (s) => s.quota === "Government Quota" && s.degreeProgram === "BE"
    );
    const cse = govStruct.departments.find((d) => d.departmentName === "CSE");
    const it = govStruct.departments.find((d) => d.departmentName === "IT");

    expect(it).toBeTruthy();
    expect(cse.semesters.find((s) => s.semesterNumber === 2)).toBeTruthy();
    expect(cse.semesters.find((s) => s.semesterNumber === 1).tuition.fee).toBe(45000);

    expect(existingDoc.markModified).toHaveBeenCalledWith("academicStructures");
    expect(existingDoc.save).toHaveBeenCalledTimes(1);
  });

  it("throws 404 when filtered delete finds no structures and list is missing", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const existingDoc = {
      academicYear: "2092-2093",
      isActive: true,
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return { academicYear: this.academicYear, isActive: this.isActive };
      },
    };

    mockFeeStructureMaster.findOne.mockResolvedValue(existingDoc);

    await expect(
      service.deleteFeeStructure("2092-2093", {
        quota: "Government Quota",
        educationType: "UG",
        degreeProgram: "BE",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when delete filters mismatch on educationType branch", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const existingDoc = {
      academicYear: "2093-2094",
      isActive: true,
      academicStructures: [
        {
          quota: "Government Quota",
          educationType: "PG",
          degreeProgram: "BE",
          isActive: true,
        },
      ],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return this;
      },
    };

    mockFeeStructureMaster.findOne.mockResolvedValue(existingDoc);

    await expect(
      service.deleteFeeStructure("2093-2094", {
        quota: "Government Quota",
        educationType: "UG",
        degreeProgram: "BE",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("covers default delete query argument", async () => {
    const { service, mockFeeStructureMaster } = loadServiceWithMocks();

    const existingDoc = {
      academicYear: "3090-3091",
      isActive: true,
      academicStructures: [],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return this;
      },
    };

    mockFeeStructureMaster.findOne.mockResolvedValue(existingDoc);

    const result = await service.deleteFeeStructure("3090-3091");
    expect(result.feeStructure).toBe(null);
  });
});
