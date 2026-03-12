const FeeRefund = require("./model.refund");
const RefundCounter = require("./modelRefundCounter");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const AppError = require("../../../utils/appError");

const ACADEMIC_HEADS = new Set(["tuition", "exam", "erp", "book", "lab"]);

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partial";
  else target.status = "Unpaid";
};

const getNextRefundReceiptNo = async () => {
  const year = String(new Date().getFullYear());
  const counter = await RefundCounter.findOneAndUpdate(
    { year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true }
  );
  const seq = String(counter.sequence).padStart(5, "0");
  return `RF-${year}-${seq}`;
};

/* ===================================================================
   CREATE REFUND
   Deducts `paid` from the StudentFeeTracking ledger, recalculates
   all parent totals, then creates an immutable FeeRefund record.
=================================================================== */
const createRefund = async (data, userId) => {
  const { rollNo, academicYear, semNumber, feeHead, refundAmount, reason } = data;

  const amount = normalizeMoney(refundAmount);
  if (amount <= 0) throw new AppError("refundAmount must be greater than 0", 400);

  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  const yearRecord = tracking.academicYearWiseRecord.find(
    (r) => r.academicYear === academicYear
  );
  if (!yearRecord) {
    throw new AppError(`Academic year ${academicYear} not found in fee tracking for this student`, 404);
  }

  // ── Locate the target component ──────────────────────────────────────────
  let component;

  if (ACADEMIC_HEADS.has(feeHead)) {
    const semKey = semNumber % 2 === 1 ? "odd" : "even";
    const sem = yearRecord.academic?.[semKey];
    if (!sem) {
      throw new AppError(
        `Semester ${semNumber} (${semKey}) not found in tracking for ${academicYear}`,
        404
      );
    }
    if (sem.semesterNumber !== semNumber) {
      throw new AppError(
        `Semester ${semNumber} does not belong to academic year ${academicYear}. ` +
          `This year has semester ${sem.semesterNumber} in the ${semKey} slot.`,
        400
      );
    }
    component = sem[feeHead];
    if (!component) {
      throw new AppError(`Fee head '${feeHead}' not found in semester ${semNumber}`, 404);
    }
  } else if (feeHead === "transport") {
    if (!yearRecord.transport?.total) {
      throw new AppError(`No transport fee record found for ${academicYear}`, 404);
    }
    component = yearRecord.transport.total;
  } else {
    // hostel
    if (!yearRecord.hostel?.total) {
      throw new AppError(`No hostel fee record found for ${academicYear}`, 404);
    }
    component = yearRecord.hostel.total;
  }

  // ── Guard: nothing paid ──────────────────────────────────────────────────
  if ((component.paid || 0) === 0) {
    throw new AppError("No paid amount to refund for this fee head", 400);
  }

  // ── Guard: cannot exceed paid ────────────────────────────────────────────
  if (amount > normalizeMoney(component.paid)) {
    throw new AppError(
      `Refund amount ₹${amount} exceeds paid amount ₹${normalizeMoney(component.paid)}`,
      400
    );
  }

  // ── Deduct paid ──────────────────────────────────────────────────────────
  component.paid = Math.max(0, normalizeMoney(component.paid - amount));
  setStatus(component);

  // ── Recalculate parent totals ────────────────────────────────────────────
  if (ACADEMIC_HEADS.has(feeHead)) {
    const semKey = semNumber % 2 === 1 ? "odd" : "even";
    const sem = yearRecord.academic[semKey];

    const semPaid = normalizeMoney(
      (sem.tuition?.paid || 0) +
        (sem.exam?.paid || 0) +
        (sem.erp?.paid || 0) +
        (sem.book?.paid || 0) +
        (sem.lab?.paid || 0)
    );
    sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
    setStatus(sem.total);

    const termTotalPaid = normalizeMoney(
      (yearRecord.academic.odd?.total?.paid || 0) +
        (yearRecord.academic.even?.total?.paid || 0)
    );
    yearRecord.academic.total.paid = Math.min(
      termTotalPaid,
      normalizeMoney(yearRecord.academic.total.total || 0)
    );
    setStatus(yearRecord.academic.total);
  }

  const yearPaid = normalizeMoney(
    (yearRecord.academic.total?.paid || 0) +
      (yearRecord.hostel?.total?.paid || 0) +
      (yearRecord.transport?.total?.paid || 0)
  );
  yearRecord.total.paid = Math.min(yearPaid, normalizeMoney(yearRecord.total.total || 0));
  setStatus(yearRecord.total);

  tracking.markModified("academicYearWiseRecord");
  await tracking.save();

  // ── Create refund record ─────────────────────────────────────────────────
  const refundReceiptNo = await getNextRefundReceiptNo();

  const refundRecord = await FeeRefund.create({
    rollNo,
    academicYear,
    semesterNumber: ACADEMIC_HEADS.has(feeHead) ? semNumber : null,
    feeHead,
    refundAmount: amount,
    reason,
    refundReceiptNo,
    refundedBy: userId,
  });

  return refundRecord;
};

/* ===================================================================
   GET REFUNDS BY STUDENT
=================================================================== */
const getRefundsByStudent = async (rollNo) => {
  const refunds = await FeeRefund.find({ rollNo })
    .sort({ createdAt: -1 })
    .populate("refundedBy", "name email")
    .lean();
  return refunds;
};

/* ===================================================================
   GET REFUNDS BY ACADEMIC YEAR
=================================================================== */
const getRefundsByYear = async (academicYear, query) => {
  const { feeHead, fromDate, toDate, page, limit } = query;

  const filter = { academicYear };
  if (feeHead) filter.feeHead = feeHead;
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, refunds] = await Promise.all([
    FeeRefund.countDocuments(filter),
    FeeRefund.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("refundedBy", "name email")
      .lean(),
  ]);

  return {
    refunds,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/* ===================================================================
   GET REFUND REPORT
=================================================================== */
const getRefundReport = async (query) => {
  const { feeHead, fromDate, toDate, operator, page, limit } = query;

  const filter = {};
  if (feeHead) filter.feeHead = feeHead;
  if (operator) filter.refundedBy = operator;
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, refunds] = await Promise.all([
    FeeRefund.countDocuments(filter),
    FeeRefund.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("refundedBy", "name email")
      .lean(),
  ]);

  return {
    refunds,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

module.exports = {
  createRefund,
  getRefundsByStudent,
  getRefundsByYear,
  getRefundReport,
};
