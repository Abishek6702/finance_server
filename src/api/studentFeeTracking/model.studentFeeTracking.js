const mongoose = require("mongoose");

function normalizeMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

function normalizeAmountSchema(amount) {
  const target = amount || {};

  target.total = normalizeMoney(target.total);
  target.paid = normalizeMoney(target.paid);
  target.paid = Math.min(target.paid, target.total);

  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partial";
  else target.status = "Unpaid";

  return target;
}

function normalizeComponentSchema(comp) {
  const target = comp || {};
  target.concession = normalizeMoney(target.concession);
  target.subTotal = normalizeMoney(target.subTotal);
  target.total = normalizeMoney(Math.max(0, target.subTotal - target.concession));
  target.paid = normalizeMoney(target.paid);
  target.paid = Math.min(target.paid, target.total);

  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partial";
  else target.status = "Unpaid";

  return target;
}

const amountSchema = new mongoose.Schema({
  total: { type: Number, default: 0, min: 0 },
  paid: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ["Paid", "Partial", "Unpaid"],
    default: "Unpaid",
  },
}, { _id: false });

const academicComponentSchema = new mongoose.Schema({
  concession: { type: Number, default: 0, min: 0 },
  subTotal: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  paid: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ["Paid", "Partial", "Unpaid"],
    default: "Unpaid",
  },
}, { _id: false });

const semesterLedgerSchema = new mongoose.Schema({
  semesterNumber: { type: Number, min: 1, max: 8 },
  tuition: { type: academicComponentSchema, default: () => ({}) },
  exam: { type: academicComponentSchema, default: () => ({}) },
  erp: { type: academicComponentSchema, default: () => ({}) },
  book: { type: academicComponentSchema, default: () => ({}) },
  lab: { type: academicComponentSchema, default: () => ({}) },
  subTotal: { type: Number, default: 0 },
  total: { type: amountSchema, default: () => ({}) },
}, { _id: false });

const transportLedgerSchema = new mongoose.Schema({
  transport: { type: String },
  route: { type: String, trim: true },
  busNo: { type: String, trim: true },
  stop: { type: String, trim: true },
  fee: { type: Number, min: 0 },
  subTotal: { type: Number, default: 0 },
  total: { type: amountSchema, default: () => ({}) },
}, { _id: false });

const hostelLedgerSchema = new mongoose.Schema({
  hostel: { type: String },
  block: { type: String, trim: true, uppercase: true },
  sharing: { type: Number },
  isAttached: { type: Boolean },
  fee: { type: Number, min: 0 },
  subTotal: { type: Number, default: 0 },
  hostelSpecialConcession: { type: Number, default: 0 },
  total: { type: amountSchema, default: () => ({}) },
}, { _id: false });

const concessionSchema = new mongoose.Schema({
  tuition: { type: Number, default: 0 },
  exam: { type: Number, default: 0 },
  erp: { type: Number, default: 0 },
  book: { type: Number, default: 0 },
  lab: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  hostel: { type: Number, default: 0 },
  totalConcession: { type: Number, default: 0 },
}, { _id: false });

const academicYearWiseRecordSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    trim: true,
    match: /^\d{4}-\d{4}$/,
    index: true,
  },
  academic: {
    odd: semesterLedgerSchema,
    even: semesterLedgerSchema,
    academicSpecialConcession: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0 },
    total: { type: amountSchema, default: () => ({}) },
  },
  transport: transportLedgerSchema,
  hostel: hostelLedgerSchema,
  concessions: concessionSchema,
  subTotal: { type: Number, default: 0 },
  total: { type: amountSchema, default: () => ({}) },
}, { _id: false });

const studentFeeTrackingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    unique: true,
    index: true,
  },
  rollNo: { type: String, index: true },
  academicYearWiseRecord: [academicYearWiseRecordSchema],
}, { timestamps: true });

studentFeeTrackingSchema.pre("save", function () {
  this.academicYearWiseRecord?.forEach((yearRecord) => {
    const academic = yearRecord.academic;

    if (!academic) {
      yearRecord.total = normalizeAmountSchema(yearRecord.total || {});
      return;
    }

    const odd = academic.odd;
    const even = academic.even;

    /* ──────────────────────────────────────────────
       Normalize concessions block
       (values are auto-derived at creation; only
       normalize numbers here, never re-apply)
    ────────────────────────────────────────────── */
    if (yearRecord.concessions) {
      const c = yearRecord.concessions;
      c.tuition   = normalizeMoney(c.tuition || 0);
      c.exam      = normalizeMoney(c.exam || 0);
      c.erp       = normalizeMoney(c.erp || 0);
      c.book      = normalizeMoney(c.book || 0);
      c.lab       = normalizeMoney(c.lab || 0);
      c.transport = normalizeMoney(c.transport || 0);
      c.hostel    = normalizeMoney(c.hostel || 0);
      c.totalConcession = normalizeMoney(
        c.tuition + c.exam + c.erp + c.book + c.lab + c.transport + c.hostel
      );
    }

    /* ──────────────────────────────────────────────
       Step 1: Normalize academic component schemas.
       Each component: concession, subTotal, total, paid, status.
       total = subTotal − concession (enforced by normalizeComponentSchema).
    ────────────────────────────────────────────── */
    const ACADEMIC_FIELDS = ["tuition", "exam", "erp", "book", "lab"];

    [odd, even].forEach((sem) => {
      if (!sem) return;
      ACADEMIC_FIELDS.forEach((f) => {
        sem[f] = normalizeComponentSchema(sem[f] || {});
      });
      // subTotal = GROSS (sum of component subTotals)
      sem.subTotal = normalizeMoney(
        ACADEMIC_FIELDS.reduce((sum, f) => sum + (sem[f]?.subTotal || 0), 0)
      );
    });

    /* ──────────────────────────────────────────────
       Step 2: Semester total = NET (sum of component totals).
       Recalculate paid and status.
    ────────────────────────────────────────────── */
    const finalizeSemester = (sem) => {
      if (!sem) return;

      const netTotal = normalizeMoney(
        ACADEMIC_FIELDS.reduce((sum, f) => sum + (sem[f]?.total || 0), 0)
      );

      sem.total = normalizeAmountSchema(sem.total || {});
      sem.total.total = netTotal;

      const semPaid = normalizeMoney(
        ACADEMIC_FIELDS.reduce((sum, f) => sum + (sem[f]?.paid || 0), 0)
      );

      sem.total.paid = Math.min(semPaid, netTotal);

      if (netTotal === 0) sem.total.status = "Paid";
      else if (sem.total.paid >= netTotal) sem.total.status = "Paid";
      else if (sem.total.paid > 0) sem.total.status = "Partial";
      else sem.total.status = "Unpaid";
    };

    finalizeSemester(odd);
    finalizeSemester(even);

    /* ──────────────────────────────────────────────
       Step 3: Academic year totals.
       academic.subTotal = GROSS (sum of semester subTotals).
       academic.total.total = NET (sum of semester net totals).
    ────────────────────────────────────────────── */
    academic.subTotal = normalizeMoney(
      (odd?.subTotal || 0) + (even?.subTotal || 0)
    );

    const academicNetTotal = normalizeMoney(
      (odd?.total?.total || 0) + (even?.total?.total || 0)
    );

    academic.total = normalizeAmountSchema(academic.total || {});
    academic.total.total = academicNetTotal;

    const academicPaid = normalizeMoney(
      (odd?.total?.paid || 0) + (even?.total?.paid || 0)
    );

    academic.total.paid = Math.min(academicPaid, academicNetTotal);

    if (academicNetTotal === 0) academic.total.status = "Paid";
    else if (academic.total.paid >= academicNetTotal) academic.total.status = "Paid";
    else if (academic.total.paid > 0) academic.total.status = "Partial";
    else academic.total.status = "Unpaid";

    /* ──────────────────────────────────────────────
       Step 4: Transport.
       Net = subTotal − enrollment concession.
    ────────────────────────────────────────────── */
    if (yearRecord.transport) {
      yearRecord.transport.subTotal = normalizeMoney(yearRecord.transport.subTotal || 0);
      yearRecord.transport.total = normalizeAmountSchema(yearRecord.transport.total || {});

      const transportEnrollConc = normalizeMoney((yearRecord.concessions?.transport) || 0);
      const transportNetTotal = normalizeMoney(
        Math.max(0,
          yearRecord.transport.subTotal
          - transportEnrollConc
        )
      );

      yearRecord.transport.total.total = transportNetTotal;
      yearRecord.transport.total.paid = Math.min(
        normalizeMoney(yearRecord.transport.total.paid || 0),
        transportNetTotal
      );
      yearRecord.transport.total = normalizeAmountSchema(yearRecord.transport.total);
    }

    /* ──────────────────────────────────────────────
       Step 5: Hostel — same idempotent pattern.
    ────────────────────────────────────────────── */
    if (yearRecord.hostel) {
      yearRecord.hostel.subTotal = normalizeMoney(yearRecord.hostel.subTotal || 0);
      yearRecord.hostel.hostelSpecialConcession = normalizeMoney(
        yearRecord.hostel.hostelSpecialConcession || 0
      );

      yearRecord.hostel.total = normalizeAmountSchema(yearRecord.hostel.total || {});

      const hostelEnrollConc = normalizeMoney((yearRecord.concessions?.hostel) || 0);
      const hostelNetTotal = normalizeMoney(
        Math.max(0,
          yearRecord.hostel.subTotal
          - hostelEnrollConc
          - yearRecord.hostel.hostelSpecialConcession
        )
      );

      yearRecord.hostel.total.total = hostelNetTotal;
      yearRecord.hostel.total.paid = Math.min(
        normalizeMoney(yearRecord.hostel.total.paid || 0),
        hostelNetTotal
      );
      yearRecord.hostel.total = normalizeAmountSchema(yearRecord.hostel.total);
    }

    /* ──────────────────────────────────────────────
       Step 6: Year-Level Totals.
       subTotal = GROSS (academic + transport + hostel).
       total = NET.
    ────────────────────────────────────────────── */
    yearRecord.subTotal = normalizeMoney(
      (academic.subTotal || 0) +
      (yearRecord.transport?.subTotal || 0) +
      (yearRecord.hostel?.subTotal || 0)
    );

    const recalculatedYearTotal = normalizeMoney(
      (academic.total?.total || 0) +
      (yearRecord.transport?.total?.total || 0) +
      (yearRecord.hostel?.total?.total || 0)
    );

    yearRecord.total = normalizeAmountSchema(yearRecord.total || {});
    yearRecord.total.total = recalculatedYearTotal;

    const recalculatedYearPaid = normalizeMoney(
      (academic.total?.paid || 0) +
      (yearRecord.transport?.total?.paid || 0) +
      (yearRecord.hostel?.total?.paid || 0)
    );

    yearRecord.total.paid = Math.min(recalculatedYearPaid, recalculatedYearTotal);
    yearRecord.total = normalizeAmountSchema(yearRecord.total);
  });
});

module.exports = mongoose.model("StudentFeeTracking", studentFeeTrackingSchema);
