const mongoose = require("mongoose");
const ReceiptRecallRequest = require("./model.receiptRecall");
const StudentTransaction = require("../transaction/model.studentTransaction");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const ActivityLog = require("../../models/ActivityLog");
const AppError = require("../../utils/AppError");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partially Paid";
  else target.status = "Unpaid";
};

/* ===================================================================
   CREATE RECALL REQUEST (Admin)
=================================================================== */
const createRecallRequest = async (data, userId) => {
  const { receiptNo, rollNo, reason } = data;

  // Find the student's transaction document
  const transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    throw new AppError("No transactions found for this student", 404);
  }

  // Find the specific receipt
  const receipt = transactionDoc.transactions.find(t => t.receiptNo === receiptNo);
  if (!receipt) {
    throw new AppError(`Receipt '${receiptNo}' not found for student ${rollNo}`, 404);
  }

  // Check for existing PENDING recall for this receipt
  const pendingRecall = await ReceiptRecallRequest.findOne({
    receiptNo,
    rollNo,
    status: "PENDING",
  });
  if (pendingRecall) {
    throw new AppError(`A pending recall request already exists for receipt '${receiptNo}'`, 409);
  }

  // Check if this receipt was already recalled (COMPLETED)
  const completedRecall = await ReceiptRecallRequest.findOne({
    receiptNo,
    rollNo,
    status: "COMPLETED",
  });
  if (completedRecall) {
    throw new AppError(`Receipt '${receiptNo}' has already been recalled`, 409);
  }

  // Create immutable snapshot of the receipt data
  const receiptSnapshot = receipt.toObject();

  const recallRequest = await ReceiptRecallRequest.create({
    receiptId: receipt._id,
    receiptNo,
    rollNo,
    reason,
    receiptSnapshot,
    createdBy: userId,
  });

  // Log audit trail
  await ActivityLog.create({
    user: userId,
    endpoint: "/api/receiptRecall",
    method: "POST",
    module: "receiptRecall",
    description: `Recall request created for receipt ${receiptNo} (student: ${rollNo})`,
    after: { recallId: recallRequest._id, receiptNo, rollNo, reason },
    meta: { status: "PENDING" },
  });

  return recallRequest;
};

/* ===================================================================
   GET RECALL REQUESTS
=================================================================== */
const getRecallRequests = async (query) => {
  const { status, rollNo, page, limit } = query;

  const filter = {};
  if (status) filter.status = status;
  if (rollNo) filter.rollNo = rollNo;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";
  const limitNum = hasLimit ? Math.min(500, Math.max(1, parseInt(limit) || 20)) : 0;

  const totalCount = await ReceiptRecallRequest.countDocuments(filter);

  let dbQuery = ReceiptRecallRequest.find(filter).sort({ createdAt: -1 });

  if (hasLimit) {
    dbQuery = dbQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
  }

  const requests = await dbQuery.lean();

  return {
    requests,
    pagination: {
      total: totalCount,
      page: hasLimit ? pageNum : 1,
      limit: hasLimit ? limitNum : totalCount,
      totalPages: hasLimit && limitNum > 0 ? Math.ceil(totalCount / limitNum) : 1,
    },
  };
};

/* ===================================================================
   ROLLBACK HELPER — reverses payment allocations in fee tracking
=================================================================== */
const executeRollback = async (recallRequest, userId, session) => {
  const { rollNo, receiptNo, receiptSnapshot } = recallRequest;
  const sessionOpt = session ? { session } : {};

  // 1. Fetch the transaction document
  const transactionDoc = session
    ? await StudentTransaction.findOne({ rollNo }).session(session)
    : await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    throw new AppError("Transaction document not found for student", 404);
  }

  // Verify receipt still exists
  const receiptIndex = transactionDoc.transactions.findIndex(t => t.receiptNo === receiptNo);
  if (receiptIndex === -1) {
    throw new AppError(`Receipt '${receiptNo}' no longer exists in transaction records`, 404);
  }

  // 2. Fetch fee tracking
  const tracking = session
    ? await StudentFeeTracking.findOne({ rollNo }).session(session)
    : await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) {
    throw new AppError("Fee tracking not found for student", 404);
  }

  // 3. Reverse all payment breakdown allocations using the snapshot
  const breakdowns = receiptSnapshot.breakdowns || [];

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) continue;

    // Reverse academic fee payments
    if (bd.academic && bd.academic.semesterNumber) {
      const semSlot = bd.academic.semesterNumber % 2 === 1 ? "odd" : "even";
      const sem = yearRecord.academic?.[semSlot];

      if (sem) {
        const fields = ["tuition", "exam", "erp", "book", "lab"];
        for (const field of fields) {
          const amount = normalizeMoney(bd.academic[field] || 0);
          if (amount > 0 && sem[field]) {
            sem[field].paid = normalizeMoney(Math.max(0, (sem[field].paid || 0) - amount));
            setStatus(sem[field]);
          }
        }

        // Recalculate semester total
        const semPaid = normalizeMoney(
          (sem.tuition?.paid || 0) + (sem.exam?.paid || 0) +
          (sem.erp?.paid || 0) + (sem.book?.paid || 0) + (sem.lab?.paid || 0)
        );
        sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
        setStatus(sem.total);
      }

      // Recalculate academic total
      const termTotalPaid = normalizeMoney(
        (yearRecord.academic.odd?.total?.paid || 0) +
        (yearRecord.academic.even?.total?.paid || 0)
      );
      yearRecord.academic.total.paid = Math.min(termTotalPaid, normalizeMoney(yearRecord.academic.total.total || 0));
      setStatus(yearRecord.academic.total);
    }

    // Reverse hostel payment
    if (bd.hostel && bd.hostel > 0 && yearRecord.hostel?.total) {
      yearRecord.hostel.total.paid = normalizeMoney(
        Math.max(0, (yearRecord.hostel.total.paid || 0) - normalizeMoney(bd.hostel))
      );
      setStatus(yearRecord.hostel.total);
    }

    // Reverse transport payment
    if (bd.transport && bd.transport > 0 && yearRecord.transport?.total) {
      yearRecord.transport.total.paid = normalizeMoney(
        Math.max(0, (yearRecord.transport.total.paid || 0) - normalizeMoney(bd.transport))
      );
      setStatus(yearRecord.transport.total);
    }

    // Recalculate year total
    const yearPaid = normalizeMoney(
      (yearRecord.academic.total?.paid || 0) +
      (yearRecord.hostel?.total?.paid || 0) +
      (yearRecord.transport?.total?.paid || 0)
    );
    yearRecord.total.paid = Math.min(yearPaid, normalizeMoney(yearRecord.total.total || 0));
    setStatus(yearRecord.total);
  }

  // 4. Remove the receipt from the transactions array
  transactionDoc.transactions.splice(receiptIndex, 1);

  // 5. Save all documents
  tracking.markModified("academicYearWiseRecord");
  await tracking.save(sessionOpt);
  await transactionDoc.save(sessionOpt);

  // 6. Update recall request status
  recallRequest.status = "COMPLETED";
  recallRequest.reviewedBy = userId;
  recallRequest.reviewedAt = new Date();
  recallRequest.completedAt = new Date();
  await recallRequest.save(sessionOpt);
};

/* ===================================================================
   APPROVE RECALL (Super Admin) — Atomic rollback
   Uses MongoDB transactions when replica set is available,
   falls back to sequential saves for standalone instances.
=================================================================== */
const approveRecall = async (recallId, userId) => {
  const recallRequest = await ReceiptRecallRequest.findById(recallId);
  if (!recallRequest) {
    throw new AppError("Recall request not found", 404);
  }
  if (recallRequest.status !== "PENDING") {
    throw new AppError(`Cannot approve a recall request with status '${recallRequest.status}'`, 400);
  }

  const { rollNo, receiptNo, receiptSnapshot } = recallRequest;

  // Try session-based transaction first (for replica set deployments)
  let usedTransaction = false;
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await executeRollback(recallRequest, userId, session);
      });
      usedTransaction = true;
    } finally {
      await session.endSession();
    }
  } catch (txnError) {
    // If transaction fails due to no replica set, fall back to sequential saves
    if (
      txnError.message?.includes("transaction") ||
      txnError.message?.includes("replica set") ||
      txnError.codeName === "NotAReplicaSet" ||
      txnError.code === 263 ||
      txnError.code === 20
    ) {
      // Re-fetch the recall request since the failed transaction may have
      // left it in an inconsistent in-memory state
      const freshRecall = await ReceiptRecallRequest.findById(recallId);
      if (!freshRecall || freshRecall.status !== "PENDING") {
        throw new AppError("Recall request is no longer in PENDING state", 400);
      }
      await executeRollback(freshRecall, userId, null);
      // Update our reference for the return value
      recallRequest.status = freshRecall.status;
      recallRequest.reviewedBy = freshRecall.reviewedBy;
      recallRequest.reviewedAt = freshRecall.reviewedAt;
      recallRequest.completedAt = freshRecall.completedAt;
    } else {
      throw txnError;
    }
  }

  // Log audit trail (non-critical)
  await ActivityLog.create({
    user: userId,
    endpoint: `/api/receiptRecall/${recallId}/approve`,
    method: "POST",
    module: "receiptRecall",
    description: `Recall approved and rollback completed for receipt ${receiptNo} (student: ${rollNo})`,
    before: { receiptSnapshot },
    after: { status: "COMPLETED" },
    meta: { status: "COMPLETED" },
  });

  return recallRequest;
};

/* ===================================================================
   REJECT RECALL (Super Admin)
=================================================================== */
const rejectRecall = async (recallId, userId, rejectReason) => {
  const recallRequest = await ReceiptRecallRequest.findById(recallId);
  if (!recallRequest) {
    throw new AppError("Recall request not found", 404);
  }
  if (recallRequest.status !== "PENDING") {
    throw new AppError(`Cannot reject a recall request with status '${recallRequest.status}'`, 400);
  }

  recallRequest.status = "REJECTED";
  recallRequest.rejectReason = rejectReason;
  recallRequest.reviewedBy = userId;
  recallRequest.reviewedAt = new Date();
  await recallRequest.save();

  // Log audit trail
  await ActivityLog.create({
    user: userId,
    endpoint: `/api/receiptRecall/${recallId}/reject`,
    method: "POST",
    module: "receiptRecall",
    description: `Recall rejected for receipt ${recallRequest.receiptNo} (student: ${recallRequest.rollNo})`,
    before: { status: "PENDING" },
    after: { status: "REJECTED", rejectReason },
    meta: { status: "REJECTED" },
  });

  return recallRequest;
};

module.exports = {
  createRecallRequest,
  getRecallRequests,
  approveRecall,
  rejectRecall,
};
