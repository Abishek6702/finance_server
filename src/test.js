/**
 * ============================================================
 * BLACKBOX API TEST SUITE
 * ============================================================
 * Run:  npm test
 * Env:  .env  (PORT, MONGO_URI, JWT_SECRET, NODE_ENV)
 *
 * OPEN-CLOSED PRINCIPLE:
 *  - Add new suites by pushing a TestSuite object into SUITES[].
 *  - No existing suite code needs to be modified.
 * ============================================================
 */

require("dotenv").config();
const http = require("http");

// ─── Config ──────────────────────────────────────────────────
const BASE = "http://localhost:5010/api";

// ─── Unique test data per run (avoids DB collisions on rerun) ─
const TS = String(Date.now());
const ctx = {
  superadminToken: null,
  adminToken:      null,
  testRollNo:      `99TS${TS.slice(-3)}`,           // e.g. 99TS123
  testAcademicYear:`${2900 + parseInt(TS.slice(-3), 10)}-${2901 + parseInt(TS.slice(-3), 10)}`,
  studentBatch:    "2025-2029",
  studentCurrentAcademicYear: "2025-2026",
  studentFeeYears: ["2025-2026", "2026-2027", "2027-2028", "2028-2029"],
  createdFeeYears: [],
};

function buildSemesterFee(semesterNumber, baseTuition) {
  const examFee = 2000;
  const erpFee = 500;
  const bookFee = 1000;
  const labFee = 1500;
  const totalFee = baseTuition + examFee + erpFee + bookFee + labFee;

  return {
    semesterNumber,
    tuition: { fee: baseTuition },
    exam: { fee: examFee },
    erp: { fee: erpFee },
    book: { fee: bookFee },
    lab: { fee: labFee },
    total: { fee: totalFee },
    isActive: true,
  };
}

function buildFeeStructurePayload(academicYear) {
  const semesters = Array.from({ length: 8 }, (_, idx) => buildSemesterFee(idx + 1, 40000 + (idx * 1000)));
  const academicDepartmentTotal = semesters.reduce((sum, sem) => sum + (sem.total?.fee || 0), 0);

  const transportTotalFee = 12000;
  const hostelRoomFee = 30000;
  const hostelMessFee = 18000;
  const hostelMaintenanceFee = 5000;
  const hostelTotalFee = hostelRoomFee + hostelMessFee + hostelMaintenanceFee;

  const grandTotal = academicDepartmentTotal + transportTotalFee + hostelTotalFee;

  return {
    academicYear,
    academicStructures: [{
      quota: "Government Quota",
      educationType: "UG",
      degreeProgram: "BE",
      departments: [{
        departmentName: "CSE",
        semesters,
        total: { fee: academicDepartmentTotal },
        isActive: true,
      }],
      total: { fee: academicDepartmentTotal },
      isActive: true,
    }],
    transportStructures: [{
      total: { fee: transportTotalFee },
      isActive: true,
    }],
    hostelStructures: [{
      block: "A-BLOCK",
      roomType: {
        sharingType: "Three",
        isAttached: true,
      },
      roomFee: { fee: hostelRoomFee },
      messFee: { fee: hostelMessFee },
      maintenanceFee: { fee: hostelMaintenanceFee },
      total: { fee: hostelTotalFee },
      isActive: true,
    }],
    total: { fee: grandTotal },
    isActive: true,
  };
}

function buildStudentPayload(rollNo) {
  return {
    personal: {
      rollNo,
      studentName: "Blackbox Tester",
      gender: "Male",
      dob: "2007-05-15",
      bloodGroup: "O+",
      aadharNo: `9999${TS.slice(-8)}`,
      emisNo: `EMIS${TS.slice(-6)}`,
      religion: "Hindu",
      community: "BC",
      casteName: "Kongu Vellalar",
      nationality: "Indian",
      studentPhoto: "https://example.com/student-photo.jpg",
    },
    academic: {
      educationType: "UG",
      academicType: "REG",
      isLateralEntry: false,
      degreeProgram: "BE",
      departmentName: "CSE",
      yearStudying: 1,
      currentSemesterNumber: 1,
      section: "A",
      batch: ctx.studentBatch,
      currentAcademicYear: ctx.studentCurrentAcademicYear,
    },
    contact: {
      selfMobileNo: "9876543210",
      selfEmail: `student${TS.slice(-6)}@mail.com`,
      officialEmail: `student${TS.slice(-6)}@sece.ac.in`,
    },
    family: {
      father: {
        name: "Tester Father",
        mobile: "9876500001",
        workType: "Farmer",
        qualification: "Diploma",
      },
      mother: {
        name: "Tester Mother",
        mobile: "9876500002",
        workType: "Homemaker",
        qualification: "HSC",
      },
      guardian: {
        name: "Tester Guardian",
        mobile: "9876500003",
      },
      familyIncomeAsPerCertificate: 180000,
      communityCertificateNo: `CC${TS.slice(-8)}`,
    },
    address: {
      permanent: {
        doorNo: "12/4",
        street: "Main Road",
        taluk: "Pollachi",
        district: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641001",
      },
      communication: {
        doorNo: "12/4",
        street: "Main Road",
        taluk: "Pollachi",
        district: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641001",
      },
    },
    enrollment: {
      quota: "Government Quota",
      firstGraduate: {
        isApplicable: false,
        concessionAmount: 0,
      },
      scheme7point5: {
        isApplicable: false,
        concessionAmount: 0,
      },
      pmssScheme: {
        isApplicable: false,
        concessionAmount: 0,
      },
      sakthiScheme: {
        isApplicable: false,
        concessionAmount: 0,
      },
      specialConcession: {
        isApplicable: false,
        transport: 0,
        hostel: 0,
        tuition: 0,
      },
    },
    transport: {
      isApplicable: false,
    },
    hostel: {
      isApplicable: false,
      block: "A-BLOCK",
      roomType: {
        sharingType: "Three",
        isAttached: true,
      },
    },
  };
}

function buildPaymentPayload(overrides = {}) {
  return {
    rollNo: ctx.testRollNo,
    receiptNo: `REC${TS.slice(-6)}`,
    paymentType: "Cash",
    bankName: "Indian Bank",
    bankLocation: "Kinathukadavu",
    remarks: "Blackbox validation payload",
    breakdowns: [{
      academicYear: ctx.studentCurrentAcademicYear,
      academic: {
        semesterNumber: 1,
        tuition: 0,
        exam: 0,
        erp: 0,
        book: 0,
        lab: 0,
      },
      hostel: 0,
      transport: 0,
    }],
    ...overrides,
  };
}

async function ensureFeeStructures(years, token) {
  for (const year of years) {
    const payload = buildFeeStructurePayload(year);
    const r = await request("POST", "/feeStructureMaster", payload, token);
    if (r.status === 201) {
      ctx.createdFeeYears.push(year);
      continue;
    }
    if (r.status === 400) continue;
    throw new Error(`Unable to ensure fee structure for ${year}. status=${r.status} body=${JSON.stringify(r.body)}`);
  }
}

// ─── HTTP Helper ─────────────────────────────────────────────
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url     = new URL(BASE + path);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const opts = {
      hostname: url.hostname,
      port:     Number(url.port) || 80,
      path:     url.pathname + url.search,
      method:   method.toUpperCase(),
      headers,
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", d => (data += d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Assertion Helper ─────────────────────────────────────────
function expect(actual, op, expected, field = "") {
  switch (op) {
    case "eq":
      if (actual !== expected) throw new Error(`Expected ${field} to eq "${expected}", got "${actual}"`);
      break;
    case "isTrue":
      if (actual !== true) throw new Error(`Expected ${field} to be true, got ${actual}`);
      break;
    case "exists":
      if (actual == null) throw new Error(`Expected ${field} to exist, got ${actual}`);
      break;
    case "isArray":
      if (!Array.isArray(actual)) throw new Error(`Expected ${field} to be an array, got ${typeof actual}`);
      break;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

// ─── Printer ─────────────────────────────────────────────────
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
};

let totalPass = 0;
let totalFail = 0;

function printSuiteHeader(name) {
  console.log(`\n${C.cyan(`━━━  ${name}  ━━━`)}`);
}

function printResult(label, passed, error = null) {
  if (passed) {
    console.log(`  ${C.green("✔ PASS")}  ${label}`);
    totalPass++;
  } else {
    console.log(`  ${C.red("✘ FAIL")}  ${label}`);
    if (error) console.log(`         ${C.yellow(`↳ ${error}`)}`);
    totalFail++;
  }
}

async function runTest(label, fn) {
  try {
    await fn();
    printResult(label, true);
  } catch (err) {
    printResult(label, false, err.message);
  }
}

// ============================================================
//  SUITES  (Open-Closed: extend by pushing a new suite object)
// ============================================================

/* ----------------------------------------------------------
   SUITE 0 : Verify Seeded Users
   Verifies that superadmin + admin accounts exist (from seed script)
   ---------------------------------------------------------- */
const suiteSeeding = {
  name: "Seed Test Users",
  run: async () => {
    await runTest("Verify superadmin exists and can login", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "superadmin@sece.ac.in",
        password: "superadmin@123",
      });
      if (r.status !== 200) throw new Error(`Superadmin not seeded. Run seed script first. Status: ${r.status}`);
    });

    await runTest("Verify admin exists and can login", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "admin@sece.ac.in",
        password: "admin@123",
      });
      if (r.status !== 200) throw new Error(`Admin not seeded. Run seed script first. Status: ${r.status}`);
    });
  },
};

/* ----------------------------------------------------------
   SUITE 1 : Auth Module
   NOTE: logout is tested LAST to keep the token alive for
   later suites.
   ---------------------------------------------------------- */
const suiteAuth = {
  name: "Auth Module",
  run: async () => {
    await runTest("POST /auth/login  →  superadmin succeeds + stores token", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "superadmin@sece.ac.in",
        password: "superadmin@123",
      });
      expect(r.status,       "eq",     200,          "status");
      expect(r.body?.token,  "exists", null,         "token");
      expect(r.body?.role,   "eq",     "superadmin", "role");
      ctx.superadminToken = r.body.token;
    });

    await runTest("POST /auth/login  →  admin succeeds + stores token", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "admin@sece.ac.in",
        password: "admin@123",
      });
      expect(r.status,      "eq",     200,   "status");
      expect(r.body?.token, "exists", null,  "token");
      expect(r.body?.role,  "eq",     "admin", "role");
      ctx.adminToken = r.body.token;
    });

    await runTest("POST /auth/login  →  wrong password → 401", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "superadmin@sece.ac.in",
        password: "WrongPass!",
      });
      expect(r.status, "eq", 401, "status");
    });

    await runTest("POST /auth/login  →  unknown user → 404", async () => {
      const r = await request("POST", "/auth/login", {
        email:    "ghost@nowhere.com",
        password: "any",
      });
      expect(r.status, "eq", 404, "status");
    });

    await runTest("POST /auth/logout  →  no token → 401", async () => {
      const r = await request("POST", "/auth/logout");
      expect(r.status, "eq", 401, "status");
    });
  },
};

/* ----------------------------------------------------------
   SUITE 2 : Fee Structure Master  (superadmin-only CRUD)
   ---------------------------------------------------------- */
const suiteFeeMaster = {
  name: "Fee Structure Master (superadmin-only)",
  run: async () => {
    const year = ctx.testAcademicYear;

    // Pre-cleanup: silently delete leftover from a previous run
    try {
      await request("DELETE", `/feeStructureMaster/${year}`, null, ctx.superadminToken);
    } catch (err) {
      // Silently ignore cleanup errors (e.g., record doesn't exist or server not running)
    }

    await runTest(`POST /feeStructureMaster  →  create ${year}`, async () => {
      const r = await request("POST", "/feeStructureMaster", buildFeeStructurePayload(year), ctx.superadminToken);
      if (r.status !== 201) throw new Error(`status=${r.status} body=${JSON.stringify(r.body)}`);
      expect(r.body?.success, "isTrue", null, "success");
    });

    await runTest("POST /feeStructureMaster  →  duplicate year → 400", async () => {
      const r = await request("POST", "/feeStructureMaster", buildFeeStructurePayload(year), ctx.superadminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("GET /feeStructureMaster  →  returns array", async () => {
      const r = await request("GET", "/feeStructureMaster", null, ctx.superadminToken);
      expect(r.status,      "eq",      200,  "status");
      expect(r.body?.data,  "isArray", null, "data");
    });

    await runTest(`GET /feeStructureMaster/:year  →  finds ${year}`, async () => {
      const r = await request("GET", `/feeStructureMaster/${year}`, null, ctx.superadminToken);
      expect(r.status,                 "eq", 200,  "status");
      expect(r.body?.data?.academicYear, "eq", year, "academicYear");
    });

    await runTest("GET /feeStructureMaster/:year  →  unknown year → 404", async () => {
      const r = await request("GET", "/feeStructureMaster/1800-1801", null, ctx.superadminToken);
      expect(r.status, "eq", 404, "status");
    });

    await runTest(`PUT /feeStructureMaster/:year  →  update succeeds`, async () => {
      const payload = buildFeeStructurePayload(year);
      payload.academicStructures[0].departments[0].semesters[0].tuition.fee = 40500;

      const r = await request("PUT", `/feeStructureMaster/${year}`, {
        ...payload,
      }, ctx.superadminToken);
      expect(r.status,        "eq",     200,  "status");
      expect(r.body?.success, "isTrue", null, "success");
    });

    // Role guards — middleware returns 401 for wrong role (server design)
    await runTest("GET /feeStructureMaster  →  admin (wrong role) → 401", async () => {
      const r = await request("GET", "/feeStructureMaster", null, ctx.adminToken);
      expect(r.status, "eq", 401, "status");
    });

    await runTest("GET /feeStructureMaster  →  no token → 401", async () => {
      const r = await request("GET", "/feeStructureMaster");
      expect(r.status, "eq", 401, "status");
    });

    // Cleanup
    await runTest(`DELETE /feeStructureMaster/:year  →  deletes ${year}`, async () => {
      const r = await request("DELETE", `/feeStructureMaster/${year}`, null, ctx.superadminToken);
      expect(r.status,        "eq",     200,  "status");
      expect(r.body?.success, "isTrue", null, "success");
    });

    await runTest("DELETE /feeStructureMaster/:year  →  unknown year → 404", async () => {
      const r = await request("DELETE", "/feeStructureMaster/1800-1801", null, ctx.superadminToken);
      expect(r.status, "eq", 404, "status");
    });
  },
};

/* ----------------------------------------------------------
   SUITE 3 : Students Management  (superadmin-only CRUD)
   Route prefix: /studentsManagement
   ---------------------------------------------------------- */
const suiteStudents = {
  name: "Students Management (superadmin-only)",
  run: async () => {
    const rollNo = ctx.testRollNo;
    const ROUTE  = "/studentsManagement";

    const testStudent = buildStudentPayload(rollNo);

    // Pre-cleanup
    try {
      await request("DELETE", `${ROUTE}/${rollNo}`, null, ctx.superadminToken);
    } catch (err) {
      // Silently ignore cleanup errors (e.g., record doesn't exist or server not running)
    }

    await runTest("Prepare required fee structures for student batch years", async () => {
      await ensureFeeStructures(ctx.studentFeeYears, ctx.superadminToken);
    });

    await runTest(`POST ${ROUTE}  →  create ${rollNo}`, async () => {
      const r = await request("POST", ROUTE, testStudent, ctx.superadminToken);
      if (r.status !== 201) throw new Error(`status=${r.status} body=${JSON.stringify(r.body)}`);
      expect(r.body?.success,             "isTrue", null,   "success");
      expect(r.body?.data?.personal?.rollNo, "eq",  rollNo, "rollNo");
    });

    await runTest(`POST ${ROUTE}  →  duplicate rollNo → 400`, async () => {
      const r = await request("POST", ROUTE, testStudent, ctx.superadminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest(`POST ${ROUTE}  →  missing rollNo → 400`, async () => {
      const invalidStudent = buildStudentPayload(rollNo);
      delete invalidStudent.personal.rollNo;

      const r = await request("POST", ROUTE,
        invalidStudent,
        ctx.superadminToken
      );
      expect(r.status, "eq", 400, "status");
    });

    await runTest(`GET ${ROUTE}  →  returns array`, async () => {
      const r = await request("GET", ROUTE, null, ctx.superadminToken);
      expect(r.status,     "eq",      200,  "status");
      expect(r.body?.data, "isArray", null, "data");
    });

    await runTest(`GET ${ROUTE}/:rollNo  →  finds ${rollNo}`, async () => {
      const r = await request("GET", `${ROUTE}/${rollNo}`, null, ctx.superadminToken);
      expect(r.status,                       "eq", 200,    "status");
      expect(r.body?.data?.personal?.rollNo, "eq", rollNo, "rollNo");
    });

    await runTest(`GET ${ROUTE}/:rollNo  →  unknown → 404`, async () => {
      const r = await request("GET", `${ROUTE}/00MISSING`, null, ctx.superadminToken);
      expect(r.status, "eq", 404, "status");
    });

    await runTest(`PUT ${ROUTE}/:rollNo  →  update student name succeeds`, async () => {
      const r = await request("PUT", `${ROUTE}/${rollNo}`,
        { ...testStudent, personal: { ...testStudent.personal, studentName: "Updated Tester" } },
        ctx.superadminToken
      );
      expect(r.status,        "eq",     200,  "status");
      expect(r.body?.success, "isTrue", null, "success");
    });

    // Role guards — middleware returns 401 for wrong role (server design)
    await runTest(`GET ${ROUTE}  →  admin (wrong role) → 401`, async () => {
      const r = await request("GET", ROUTE, null, ctx.adminToken);
      expect(r.status, "eq", 401, "status");
    });

    await runTest(`GET ${ROUTE}  →  no token → 401`, async () => {
      const r = await request("GET", ROUTE);
      expect(r.status, "eq", 401, "status");
    });

    // Cleanup
    await runTest(`DELETE ${ROUTE}/:rollNo  →  deletes ${rollNo}`, async () => {
      const r = await request("DELETE", `${ROUTE}/${rollNo}`, null, ctx.superadminToken);
      expect(r.status,        "eq",     200,  "status");
      expect(r.body?.success, "isTrue", null, "success");
    });

    await runTest(`DELETE ${ROUTE}/:rollNo  →  unknown → 404`, async () => {
      const r = await request("DELETE", `${ROUTE}/00MISSING`, null, ctx.superadminToken);
      expect(r.status, "eq", 404, "status");
    });

    await runTest("Cleanup fee structures created only by this test run", async () => {
      for (const year of ctx.createdFeeYears) {
        const r = await request("DELETE", `/feeStructureMaster/${year}`, null, ctx.superadminToken);
        if (r.status !== 200 && r.status !== 404) {
          throw new Error(`Cleanup failed for ${year}. status=${r.status} body=${JSON.stringify(r.body)}`);
        }
      }
      ctx.createdFeeYears = [];
    });
  },
};

/* ----------------------------------------------------------
   SUITE 4 : Fee Payment — Admin Read APIs
   ---------------------------------------------------------- */
const suiteFeePayment = {
  name: "Fee Payment — Admin Read APIs",
  run: async () => {
    await runTest("GET /feePayment/recent  →  returns array (admin)", async () => {
      const r = await request("GET", "/feePayment/recent", null, ctx.adminToken);
      expect(r.status,        "eq",      200,  "status");
      expect(r.body?.success, "isTrue",  null, "success");
      expect(r.body?.data,    "isArray", null, "data");
    });

    await runTest("GET /feePayment/recent?year=2025-2026  →  year filter accepted", async () => {
      const r = await request("GET", "/feePayment/recent?year=2025-2026", null, ctx.adminToken);
      expect(r.status,     "eq",      200,  "status");
      expect(r.body?.data, "isArray", null, "data");
    });

    await runTest("GET /feePayment/recent?department=CSE  →  dept filter accepted", async () => {
      const r = await request("GET", "/feePayment/recent?department=CSE", null, ctx.adminToken);
      expect(r.status,     "eq",      200,  "status");
      expect(r.body?.data, "isArray", null, "data");
    });

    await runTest("GET /feePayment/recent?fromDate=2024-01-01&toDate=2026-12-31  →  date filter accepted", async () => {
      const r = await request("GET", "/feePayment/recent?fromDate=2024-01-01&toDate=2026-12-31", null, ctx.adminToken);
      expect(r.status,     "eq",      200,  "status");
      expect(r.body?.data, "isArray", null, "data");
    });

    await runTest("GET /feePayment/summary  →  returns summary array and aggregates (admin)", async () => {
      const r = await request("GET", "/feePayment/summary", null, ctx.adminToken);
      expect(r.status,        "eq",      200,  "status");
      expect(r.body?.success, "isTrue",  null, "success");
      expect(r.body?.data?.records,    "isArray", null, "records");
      expect(r.body?.data?.aggregate,  "exists",  null, "aggregate");
    });

    await runTest("GET /feePayment/summary?year=2025-2026  →  year filter works", async () => {
      const r = await request("GET", "/feePayment/summary?year=2025-2026", null, ctx.adminToken);
      expect(r.status, "eq", 200, "status");
    });

    await runTest("GET /feePayment/students  →  returns list (admin)", async () => {
      const r = await request("GET", "/feePayment/students", null, ctx.adminToken);
      expect(r.status,        "eq",      200,  "status");
      expect(r.body?.success, "isTrue",  null, "success");
      expect(r.body?.data,    "isArray", null, "data");
    });

    await runTest("GET /feePayment/students?department=CSE  →  dept filter works", async () => {
      const r = await request("GET", "/feePayment/students?department=CSE", null, ctx.adminToken);
      expect(r.status,     "eq",      200,  "status");
      expect(r.body?.data, "isArray", null, "data");
    });

    await runTest("GET /feePayment/summary/:rollNo  →  non-existent → 404", async () => {
      const r = await request("GET", "/feePayment/summary/00MISSING000", null, ctx.adminToken);
      expect(r.status, "eq", 404, "status");
    });

    await runTest("GET /feePayment/:rollNo  →  non-existent → 404", async () => {
      const r = await request("GET", "/feePayment/00MISSING000", null, ctx.adminToken);
      expect(r.status, "eq", 404, "status");
    });

    await runTest("PUT /feePayment/receipt/:receiptNo  →  update receipt non-existent → 400 or 404", async () => {
      const r = await request("PUT", "/feePayment/receipt/00MISSING000", {
        paymentType: "UPI",
        bankName: "SBI",
        bankLocation: "Coimbatore",
        remarks: "Updated remark",
      }, ctx.adminToken);
      expect(r.status, "eq", 400, "status"); // because transaction is not found
    });

    await runTest("PUT /feePayment/concession/:rollNo/:academicYear  →  non-existent → 400", async () => {
      const r = await request("PUT", `/feePayment/concession/00MISSING000/${ctx.testAcademicYear}`, {
        concessions: {
          firstGraduate: 1000,
          scheme7point5: 500,
          pmss: 1000,
          sakthi: 250,
        }
      }, ctx.adminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("POST /feePayment/pay  →  missing rollNo → 400", async () => {
      const payload = buildPaymentPayload();
      delete payload.rollNo;
      const r = await request("POST", "/feePayment/pay", payload, ctx.adminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("POST /feePayment/pay  →  invalid paymentType → 400", async () => {
      const r = await request("POST", "/feePayment/pay", buildPaymentPayload({
        paymentType: "Bitcoin",
      }), ctx.adminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("GET /feePayment/recent  →  no token → 401", async () => {
      const r = await request("GET", "/feePayment/recent");
      expect(r.status, "eq", 401, "status");
    });
  },
};

/* ----------------------------------------------------------
   SUITE 5 : Auth — Logout (must run last to keep token alive)
   ---------------------------------------------------------- */
const suiteAuthLogout = {
  name: "Auth Logout (final cleanup)",
  run: async () => {
    await runTest("POST /auth/logout  →  superadmin valid token succeeds", async () => {
      const r = await request("POST", "/auth/logout", null, ctx.superadminToken);
      expect(r.status, "eq", 200, "status");
    });

    await runTest("POST /auth/logout  →  admin valid token succeeds", async () => {
      const r = await request("POST", "/auth/logout", null, ctx.adminToken);
      expect(r.status, "eq", 200, "status");
    });
  },
};

// ─── SUITES REGISTRY ─────────────────────────────────────────
// Open-Closed: add new suites by ONLY appending to this array.
const SUITES = [
  suiteSeeding,
  suiteAuth,
  suiteFeeMaster,
  suiteStudents,
  suiteFeePayment,
  suiteAuthLogout,
];

// ─── Runner ──────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold("╔══════════════════════════════════════════════╗")}`);
  console.log(`${C.bold("║    SECE Finance API  —  BlackBox Test Suite   ║")}`);
  console.log(`${C.bold("╚══════════════════════════════════════════════╝")}`);
  console.log(`  Base URL   : ${BASE}`);
  console.log(`  Node Env   : ${process.env.NODE_ENV}`);
  console.log(`  Test RollNo: ${ctx.testRollNo}`);
  console.log(`  Test Year  : ${ctx.testAcademicYear}`);

  for (const suite of SUITES) {
    printSuiteHeader(suite.name);
    await suite.run();
  }

  const total = totalPass + totalFail;
  console.log(`\n${C.bold("════════════════════════════════════════════════")}`);
  console.log(`  Total Tests : ${total}`);
  console.log(`  ${C.green(`Passed      : ${totalPass}`)}`);
  console.log(`  ${C.red(`Failed      : ${totalFail}`)}`);
  console.log(C.bold("════════════════════════════════════════════════\n"));

  if (totalFail > 0) process.exit(1);
}

main().catch(err => {
  console.error(`\n${C.red("[RUNNER ERROR]")} ${err.message}`);
  process.exit(1);
});
