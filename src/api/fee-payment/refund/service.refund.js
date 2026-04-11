const mongoose = require("mongoose");
const FeeRefund = require("./model.refund");
const RefundCounter = require("./modelRefundCounter");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");
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

const getNextRefundReceiptNo = async ({ session = null } = {}) => {
  const year = String(new Date().getFullYear());
  const counter = await RefundCounter.findOneAndUpdate(
    { year },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true }
  ).session(session);
  const seq = String(counter.sequence).padStart(5, "0");
  return `RF-${year}-${seq}`;
};

/* ===================================================================
   CREATE REFUND
   Deducts `paid` from the StudentFeeTracking ledger, recalculates
   all parent totals, then creates an immutable FeeRefund record.
=================================================================== */
const createRefund = async (data, userId, options = {}) => {
  const {
    rollNo,
    academicYear,
    semNumber,
    feeHead,
    refundAmount,
    reason,
    idempotencyKey,
    isActive,
    refundMode,
    paymentFrom,
    collegeAccount,
    studentBankName,
    studentAccount,
    studentAccountNumber,
  } = data;
    const normalizedRefundMode = String(refundMode || "").trim().toLowerCase() || "cash";
    const normalizedPaymentFrom =
      normalizedRefundMode === "bank"
        ? String(paymentFrom || collegeAccount || "").trim() || null
        : null;
    const normalizedStudentBankName =
      normalizedRefundMode === "bank"
        ? String(studentBankName || "").trim() || null
        : null;
    const normalizedStudentAccount =
      normalizedRefundMode === "bank"
        ? String(studentAccountNumber || studentAccount || "").trim() || null
        : null;

  const deactivateAfterRefund = isActive === false;
  const { session: externalSession = null } = options;

  const amount = normalizeMoney(refundAmount);
  if (amount <= 0) throw new AppError("refundAmount must be greater than 0", 400);

  const ownSession = externalSession ? null : await mongoose.startSession();
  const session = externalSession || ownSession;
  if (ownSession) ownSession.startTransaction();

  const withSession = (query) => query.session(session);

  try {
    if (idempotencyKey) {
      const existingRefund = await withSession(FeeRefund.findOne({ idempotencyKey }));
      if (existingRefund) {
        return existingRefund; // or throw a 409 Conflict if preferred
      }
    }

    const tracking = await withSession(StudentFeeTracking.findOne({ rollNo }));
    if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

    if (feeHead === "excessAmount") {
      if (deactivateAfterRefund) {
        throw new AppError("isActive=false is not supported for excessAmount refunds", 400);
      }
      const student = await withSession(Student.findOne({ "personal.rollNo": rollNo }));
      if (!student) {
        throw new AppError("Student not found", 404);
      }

      const currentExcess = normalizeMoney(student.enrollment?.excessAmount || 0);
      if (currentExcess < amount) {
        throw new AppError(`Refund amount ₹${amount} exceeds available excess amount ₹${currentExcess}`, 400);
      }

      const updatedExcess = normalizeMoney(currentExcess - amount);
      student.enrollment.excessAmount = updatedExcess;
      student.enrollment.isExcessAmountTrue = updatedExcess > 0;
      await student.save({ session });

      const refundReceiptNo = await getNextRefundReceiptNo({ session });
      const [refundRecord] = await FeeRefund.create([{
        rollNo,
        academicYear,
        semesterNumber: null,
        feeHead,
        refundAmount: amount,
        reason,
        refundReceiptNo,
        refundedBy: userId,
        ledgerIsActive: true,
        refundMode: normalizedRefundMode,
        idempotencyKey,
        paymentFrom: normalizedPaymentFrom,
        collegeAccount: normalizedPaymentFrom,
        studentBankName: normalizedStudentBankName,
        studentAccount: normalizedStudentAccount,
      }], { session });

      if (ownSession) await ownSession.commitTransaction();
      return refundRecord;
    }

    const yearRecord = tracking.academicYearWiseRecord.find(
      (r) => r.academicYear === academicYear
    );
    if (!yearRecord) {
      throw new AppError(`Academic year ${academicYear} not found in fee tracking for this student`, 404);
    }

    // ── Locate the target component ──────────────────────────────────────────
    let component;
    let ledgerContainer;

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
      ledgerContainer = component;
      if (!component) {
        throw new AppError(`Fee head '${feeHead}' not found in semester ${semNumber}`, 404);
      }
    } else if (feeHead === "transport") {
      if (!yearRecord.transport?.total) {
        throw new AppError(`No transport fee record found for ${academicYear}`, 404);
      }
      component = yearRecord.transport.total;
      ledgerContainer = yearRecord.transport;
    } else {
      // hostel
      if (!yearRecord.hostel?.total) {
        throw new AppError(`No hostel fee record found for ${academicYear}`, 404);
      }
      component = yearRecord.hostel.total;
      ledgerContainer = yearRecord.hostel;
    }

    if (deactivateAfterRefund) {
      if (amount > normalizeMoney(component.total || 0)) {
        throw new AppError(
          `Refund amount ₹${amount} exceeds total amount ₹${normalizeMoney(component.total || 0)}`,
          400
        );
      }

      if (ACADEMIC_HEADS.has(feeHead)) {
        if (component.isActive === false) {
          throw new AppError(`Fee head '${feeHead}' is already inactive for semester ${semNumber}`, 400);
        }
      } else if (ledgerContainer?.isActive === false) {
        throw new AppError(`${feeHead} ledger is already inactive for ${academicYear}`, 400);
      }
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

    if (deactivateAfterRefund) {
      if (ACADEMIC_HEADS.has(feeHead)) {
        component.total = Math.max(0, normalizeMoney((component.total || 0) - amount));
        component.concession = normalizeMoney((component.concession || 0) + amount);
        component.isActive = false;
      } else if (feeHead === "transport") {
        yearRecord.transport.isActive = false;
        if (!yearRecord.transport.endDate) yearRecord.transport.endDate = new Date();
      } else if (feeHead === "hostel") {
        yearRecord.hostel.isActive = false;
        if (!yearRecord.hostel.endDate) yearRecord.hostel.endDate = new Date();
      }
    }

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
    await tracking.save({ session });

    // ── Create refund record ─────────────────────────────────────────────────
    const refundReceiptNo = await getNextRefundReceiptNo({ session });

    const [refundRecord] = await FeeRefund.create([{
      rollNo,
      academicYear,
      semesterNumber: ACADEMIC_HEADS.has(feeHead) ? semNumber : null,
      feeHead,
      refundAmount: amount,
      reason,
      refundReceiptNo,
      refundedBy: userId,
      ledgerIsActive: deactivateAfterRefund ? false : true,
      refundMode: normalizedRefundMode,
      idempotencyKey,
      paymentFrom: normalizedPaymentFrom,
      collegeAccount: normalizedPaymentFrom,
      studentBankName: normalizedStudentBankName,
      studentAccount: normalizedStudentAccount,
    }], { session });

    if (ownSession) await ownSession.commitTransaction();
    return refundRecord;

  } catch (error) {
    console.error("REFUND ERROR:", error);
    if (ownSession) await ownSession.abortTransaction();
    throw error;
  } finally {
    if (ownSession) ownSession.endSession();
  }
};

/* ===================================================================
   GET REFUND FLAT REPORT
=================================================================== */
const getRefundFlatReport = async (query) => {
  const { year, department, mode, date, page, limit } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const match = {};
  if (year) {
    match.academicYear = year;
  }
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    match.createdAt = { $gte: start, $lte: end };
  }

  const departmentFilter = department ? String(department).trim().toUpperCase() : null;
  const modeFilter = mode ? String(mode).trim().toLowerCase() : null;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "students",
        let: { refundRollNo: "$rollNo" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$personal.rollNo", "$$refundRollNo"] },
            },
          },
          {
            $project: {
              _id: 0,
              name: "$personal.studentName",
              profileUrl: "$personal.studentPhoto",
              rollNumber: "$personal.rollNo",
              yearOfStudying: "$academic.yearStudying",
              department: "$academic.departmentName",
            },
          },
        ],
        as: "student",
      },
    },
    {
      $unwind: {
        path: "$student",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        paymentMode: {
          $ifNull: [
            "$refundMode",
            {
              $cond: [
                {
                  $or: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$studentBankName", ""] } }, 0] },
                    { $gt: [{ $strLenCP: { $ifNull: ["$studentAccount", ""] } }, 0] },
                  ],
                },
                "bank",
                "cash",
              ],
            },
          ],
        },
      },
    },
  ];

  if (departmentFilter) {
    pipeline.push({ $match: { "student.department": departmentFilter } });
  }

  if (modeFilter) {
    pipeline.push({ $match: { paymentMode: modeFilter } });
  }

  pipeline.push(
    {
      $project: {
        _id: 0,
        name: { $ifNull: ["$student.name", ""] },
        profileUrl: { $ifNull: ["$student.profileUrl", ""] },
        rollNumber: "$rollNo",
        yearOfStudying: { $ifNull: ["$student.yearOfStudying", null] },
        department: { $ifNull: ["$student.department", ""] },
        receiptNumber: "$refundReceiptNo",
        semPeriod: {
          $cond: [
            { $or: [{ $eq: ["$semesterNumber", null] }, { $eq: ["$semesterNumber", 0] }] },
            "-",
            {
              $cond: [
                { $eq: [{ $mod: ["$semesterNumber", 2] }, 0] },
                "even",
                "odd",
              ],
            },
          ],
        },
        feesHead: "$feeHead",
        amount: "$refundAmount",
        raisedOn: "$createdAt",
        approvedOn: "$updatedAt",
        RefundMode: "$paymentMode",
        paymentMode: "$paymentMode",
        paymentFrom: { $ifNull: ["$paymentFrom", { $ifNull: ["$collegeAccount", ""] }] },
        studentBankName: { $ifNull: ["$studentBankName", ""] },
        studentAccountNumber: { $ifNull: ["$studentAccount", ""] },
        bankName: { $ifNull: ["$studentBankName", ""] },
        accountNo: { $ifNull: ["$studentAccount", ""] },
      },
    },
    { $sort: { raisedOn: -1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: limitNum }],
        metadata: [{ $count: "total" }],
      },
    }
  );

  const [result] = await FeeRefund.aggregate(pipeline);
  const rows = result?.rows || [];
  const total = result?.metadata?.[0]?.total || 0;

  return {
    rows,
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
  getRefundFlatReport,
};
