/**
 * utils.bulkParse.js
 * Parses CSV / Excel uploads into an array of student data objects
 * that match the shape expected by service.students.js.
 *
 * Handles:
 *  - Both .csv and .xlsx/.xls files (via the `xlsx` package)
 *  - Case-insensitive / extra-whitespace column headers
 *  - Misaligned / unknown columns (silently ignored)
 *  - Null / empty / undefined cell values
 *  - Excel serial date numbers
 *  - Aadhar numbers stored as scientific notation (e.g. 1.23412E+11)
 *  - Batch fields that contain extra data (e.g. "2022-2026    2025-2026")
 *  - Boolean strings ("TRUE" / "FALSE" / "1" / "0")
 *  - Number coercion for concessions, income, sharing etc.
 */

const xlsx = require("xlsx");

/* -------------------------------------------------------
   Flat CSV column  →  path inside the student payload
------------------------------------------------------- */
const COLUMN_PATH_MAP = {
  // ── personal ──────────────────────────────────────────
  rollno:                      "personal.rollNo",
  studentname:                 "personal.studentName",
  gender:                      "personal.gender",
  dob:                         "personal.dob",
  bloodgroup:                  "personal.bloodGroup",
  aadharno:                    "personal.aadharNo",
  emisno:                      "personal.emisNo",
  religion:                    "personal.religion",
  community:                   "personal.community",
  castename:                   "personal.casteName",
  nationality:                 "personal.nationality",
  studentphoto:                "personal.studentPhoto",

  // ── academic ──────────────────────────────────────────
  educationtype:               "academic.educationType",
  academictype:                "academic.academicType",
  islateralentry:              "academic.isLateralEntry",
  departmentname:              "academic.departmentName",
  degreeprogram:               "academic.degreeProgram",
  yearstudying:                "academic.yearStudying",
  currentsemesternumber:       "academic.currentSemesterNumber",
  section:                     "academic.section",
  batch:                       "academic.batch",
  currentacademicyear:         "academic.currentAcademicYear",

  // ── contact ───────────────────────────────────────────
  selfmobileno:                "contact.selfMobileNo",
  selfemail:                   "contact.selfEmail",
  officialemail:               "contact.officialEmail",

  // ── family ────────────────────────────────────────────
  fathername:                  "family.father.name",
  fathermobile:                "family.father.mobile",
  fatherworktype:              "family.father.workType",
  fatherqualification:         "family.father.qualification",
  mothername:                  "family.mother.name",
  mothermobile:                "family.mother.mobile",
  motherworktype:              "family.mother.workType",
  motherqualification:         "family.mother.qualification",
  guardianname:                "family.guardian.name",
  guardianmobile:              "family.guardian.mobile",
  familyincomeaspercertificate:"family.familyIncomeAsPerCertificate",
  communitycertificateno:      "family.communityCertificateNo",

  // ── address – permanent ───────────────────────────────
  permdoorno:                  "address.permanent.doorNo",
  permstreet:                  "address.permanent.street",
  permtaluk:                   "address.permanent.taluk",
  permdistrict:                "address.permanent.district",
  permstate:                   "address.permanent.state",
  permpincode:                 "address.permanent.pincode",

  // ── address – communication ───────────────────────────
  commdoorno:                  "address.communication.doorNo",
  commstreet:                  "address.communication.street",
  commtaluk:                   "address.communication.taluk",
  commdistrict:                "address.communication.district",
  commstate:                   "address.communication.state",
  commpincode:                 "address.communication.pincode",

  // ── enrollment ────────────────────────────────────────
  quota:                       "enrollment.quota",
  firstgraduateapplicable:     "enrollment.firstGraduate.isApplicable",
  firstgraduateconcession:     "enrollment.firstGraduate.concessionAmount",
  scheme7point5applicable:     "enrollment.scheme7point5.isApplicable",
  scheme7point5concession:     "enrollment.scheme7point5.concessionAmount",
  pmssapplicable:              "enrollment.pmssScheme.isApplicable",
  pmssconcession:              "enrollment.pmssScheme.concessionAmount",
  sakthiapplicable:            "enrollment.sakthiScheme.isApplicable",
  sakthiconcession:            "enrollment.sakthiScheme.concessionAmount",
  specialapplicable:           "enrollment.specialConcession.isApplicable",
  specialtransport:            "enrollment.specialConcession.transport",
  specialhostel:               "enrollment.specialConcession.hostel",
  specialtuition:              "enrollment.specialConcession.tuition",

  // ── transport ─────────────────────────────────────────
  transportapplicable:         "transport.isApplicable",
  transportroute:              "transport.route",
  transportstop:               "transport.stopName",

  // ── hostel ────────────────────────────────────────────
  hostelapplicable:            "hostel.isApplicable",
  hostelblock:                 "hostel.block",
  hostelsharing:               "hostel.sharing",
  hostelattached:              "hostel.isAttached",
};

/* -------------------------------------------------------
   Normalise a column header for lookup
------------------------------------------------------- */
const normaliseKey = (raw) =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]/g, "");   // remove spaces, underscores, hyphens

/* -------------------------------------------------------
   Value sanitisers
------------------------------------------------------- */

/** Returns true / false / null (null = not a recognised boolean) */
const parseBool = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true"  || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no")  return false;
  return null;    // unrecognised – caller decides
};

/** Parse a non-negative integer, returns null if invalid */
const parseIntPositive = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Parse a non-negative float, returns null if invalid */
const parseFloatNonNeg = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * Aadhar numbers often arrive as Excel scientific-notation floats
 * (e.g. 1.23412E+11 → 123412000000).  Return a zero-padded 12-char string.
 */
const parseAadhar = (v) => {
  if (v == null || String(v).trim() === "") return null;
  // Already looks like 12 digits
  const asStr = String(v).trim();
  if (/^\d{12}$/.test(asStr)) return asStr;
  // Try numeric conversion (handles scientific notation)
  const asNum = Number(v);
  if (Number.isFinite(asNum)) {
    const full = Math.round(asNum).toString();
    return full.padStart(12, "0").slice(-12);
  }
  return asStr;   // return as-is and let validation catch it
};

/**
 * `batch` cells can contain extra whitespace-separated data
 * (e.g. "2022-2026    2025-2026").  Extract the first YYYY-YYYY token.
 */
const parseBatch = (v) => {
  if (v == null) return null;
  const match = String(v).match(/(\d{4}-\d{4})/);
  return match ? match[1] : String(v).trim();
};

/**
 * Parse a date value that can be:
 *  - an Excel serial number (number)  e.g. 38300
 *  - a JS Date object
 *  - a string in DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or ISO
 * Always returns a UTC-midnight Date so timezone offsets do not shift the day.
 * Returns null for unrecognised / empty values.
 */
const parseDate = (v) => {
  if (v == null || String(v).trim() === "") return null;

  // Excel serial date number – decode via xlsx then use UTC to avoid local-timezone shift
  if (typeof v === "number") {
    const d = xlsx.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    return null;
  }

  // JS Date already – normalise to UTC midnight of the same calendar day
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }

  const s = String(v).trim();

  // DD-MM-YYYY or DD/MM/YYYY  (treat as day-first regardless of locale)
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return isNaN(d) ? null : d;
  }

  // YYYY-MM-DD (ISO date-only) – already UTC midnight when parsed by new Date
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return isNaN(d) ? null : d;
  }

  // Full ISO string with time component – keep as-is
  const fallback = new Date(s);
  return isNaN(fallback) ? null : fallback;
};

/** Return null for blank / whitespace-only strings */
const parseString = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/* -------------------------------------------------------
   Field-specific sanitiser dispatch
------------------------------------------------------- */
const BOOLEAN_PATHS = new Set([
  "academic.isLateralEntry",
  "enrollment.firstGraduate.isApplicable",
  "enrollment.scheme7point5.isApplicable",
  "enrollment.pmssScheme.isApplicable",
  "enrollment.sakthiScheme.isApplicable",
  "enrollment.specialConcession.isApplicable",
  "transport.isApplicable",
  "hostel.isApplicable",
  "hostel.isAttached",
]);

const NUMBER_PATHS = new Set([
  "academic.yearStudying",
  "academic.currentSemesterNumber",
  "family.familyIncomeAsPerCertificate",
  "enrollment.firstGraduate.concessionAmount",
  "enrollment.scheme7point5.concessionAmount",
  "enrollment.pmssScheme.concessionAmount",
  "enrollment.sakthiScheme.concessionAmount",
  "enrollment.specialConcession.transport",
  "enrollment.specialConcession.hostel",
  "enrollment.specialConcession.tuition",
  "hostel.sharing",
]);

const sanitiseValue = (path, raw) => {
  if (raw == null || String(raw).trim() === "") return undefined; // skip nulls

  if (path === "personal.dob")      return parseDate(raw);
  if (path === "personal.aadharNo") return parseAadhar(raw);
  if (path === "academic.batch")    return parseBatch(raw);

  if (BOOLEAN_PATHS.has(path)) {
    const b = parseBool(raw);
    return b === null ? undefined : b;
  }

  if (path === "academic.yearStudying" || path === "academic.currentSemesterNumber" || path === "hostel.sharing") {
    const n = parseIntPositive(raw);
    return n === null ? undefined : n;
  }

  if (NUMBER_PATHS.has(path)) {
    const n = parseFloatNonNeg(raw);
    return n === null ? undefined : n;
  }

  return parseString(raw);
};

/* -------------------------------------------------------
   Set a nested value by dot-path, creating objects along the way
------------------------------------------------------- */
const setNested = (obj, dotPath, value) => {
  if (value === undefined) return;   // nothing to set
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

/* -------------------------------------------------------
   Build a normalised header → path lookup from a sheet row
   (handles extra / unknown columns gracefully)
------------------------------------------------------- */
const buildHeaderMap = (rawHeaders) => {
  const map = {};   // index → dotPath  (unknown columns omitted)
  rawHeaders.forEach((h, idx) => {
    const key = normaliseKey(h);
    const path = COLUMN_PATH_MAP[key];
    if (path) map[idx] = path;
    // else: unknown column – silently skip
  });
  return map;
};

/* -------------------------------------------------------
   Parse a workbook sheet into an array of raw objects
   Handles misaligned columns by using the header row.
------------------------------------------------------- */
const sheetToRawRows = (sheet) => {
  // raw:true keeps every cell as its stored value (no xlsx type-inference on text).
  // Numeric date-serial cells stay as numbers; text date strings stay as strings.
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: true });
  if (rows.length < 2) return [];

  const headerRow = rows[0];
  const headerMap = buildHeaderMap(headerRow);

  const result = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // Skip completely empty rows
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;

    const obj = {};
    row.forEach((cell, colIdx) => {
      const path = headerMap[colIdx];
      if (!path) return;   // unknown / misaligned column
      const sanitised = sanitiseValue(path, cell);
      setNested(obj, path, sanitised);
    });

    result.push(obj);
  }
  return result;
};

/* -------------------------------------------------------
   Public API: parse a file Buffer (or Uint8Array) to
   an array of student-shaped objects.
   `mimetype` hint (optional) – falls back to auto-detect.
------------------------------------------------------- */
const parseStudentFile = (buffer, originalname = "") => {
  // raw:true disables xlsx's cell-type inference for BOTH csv and xlsx.
  // This means date strings like "14-05-2005" remain as text "14-05-2005"
  // and are parsed by our own parseDate (DD-MM-YYYY format).
  // Genuine Excel date-typed cells still come back as serial numbers
  // because Excel encodes them as numeric cells in the binary format.
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false, raw: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  return sheetToRawRows(firstSheet);
};

module.exports = { parseStudentFile };
