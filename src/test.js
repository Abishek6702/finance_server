/**
 * ============================================================
 * BLACKBOX API TEST SUITE
 * ============================================================
 * Run:  npm test   (server must be running separately)
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
};

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
      const r = await request("POST", "/feeStructureMaster", {
        academicYear: year,
        academicStructures: [{
          quota:          "Government Quota",
          educationType:  "UG",
          degreeProgram:  "BE",
          departments: [{
            departmentName: "CSE",
            semesters: [{
              semesterNumber: 1,
              tuition: { fee: 40000 }, exam: { fee: 2000 },
              erp:     { fee: 500  }, book: { fee: 500  }, lab: { fee: 1000 },
            }],
          }],
        }],
        transportStructures: [],
        hostelStructures:    [],
      }, ctx.superadminToken);
      if (r.status !== 201) throw new Error(`status=${r.status} body=${JSON.stringify(r.body)}`);
      expect(r.body?.success, "isTrue", null, "success");
    });

    await runTest("POST /feeStructureMaster  →  duplicate year → 400", async () => {
      const r = await request("POST", "/feeStructureMaster",
        { academicYear: year }, ctx.superadminToken);
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
      const r = await request("PUT", `/feeStructureMaster/${year}`, {
        academicYear:        year,
        academicStructures:  [],
        transportStructures: [],
        hostelStructures:    [],
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

    const testStudent = {
      personal: {
        rollNo,
        studentName: "Blackbox Tester",
        gender:      "Male",
        community:   "BC",
        nationality: "Indian",
      },
      academic: {
        educationType:         "UG",
        academicType:          "REG",
        degreeProgram:         "BE",
        departmentName:        "CSE",
        yearStudying:          1,
        currentSemesterNumber: 1,
        batch:                 "2025-2029",
        currentAcademicYear:   "2025-2026",
      },
      contact:    {},
      enrollment: { quota: "Government Quota" },
      transport:  { isApplicable: false },
      hostel:     { isApplicable: false },
    };

    // Pre-cleanup
    try {
      await request("DELETE", `${ROUTE}/${rollNo}`, null, ctx.superadminToken);
    } catch (err) {
      // Silently ignore cleanup errors (e.g., record doesn't exist or server not running)
    }

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
      const r = await request("POST", ROUTE,
        { ...testStudent, personal: { studentName: "No Roll" } },
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
      const r = await request("PUT", "/feePayment/receipt/00MISSING000", { remarks: "Updated remark" }, ctx.adminToken);
      expect(r.status, "eq", 400, "status"); // because transaction is not found
    });

    await runTest("PUT /feePayment/concession/:rollNo/:academicYear  →  non-existent → 400", async () => {
      const r = await request("PUT", `/feePayment/concession/00MISSING000/${ctx.testAcademicYear}`, {
        concessions: { pmss: 1000 }
      }, ctx.adminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("POST /feePayment/pay  →  missing rollNo → 400", async () => {
      const r = await request("POST", "/feePayment/pay", {
        receiptNo:   "REC001",
        paymentType: "Cash",
        breakdowns:  [{ academicYear: "2025-2026" }],
      }, ctx.adminToken);
      expect(r.status, "eq", 400, "status");
    });

    await runTest("POST /feePayment/pay  →  invalid paymentType → 400", async () => {
      const r = await request("POST", "/feePayment/pay", {
        rollNo:      "21CS001",
        receiptNo:   "REC001",
        paymentType: "Bitcoin",
        breakdowns:  [{ academicYear: "2025-2026" }],
      }, ctx.adminToken);
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
