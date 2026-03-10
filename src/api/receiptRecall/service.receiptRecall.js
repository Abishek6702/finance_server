const mongoose = require("mongoose");
const ReceiptRecallRequest = require("./model.receiptRecall");
const StudentTransaction = require("../feePayments/model.studentFeePayments");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");
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
   CREATE RECALL — Admin directly recalls specific fee heads
   • Reverses payment allocations in fee tracking per fee-head type
   • Removes recalled fee heads from the breakdown; prunes empty breakdowns
   • If all breakdowns are removed, removes the entire receipt
=================================================================== */
const createRecall = async (data, userId) => {
  const { receiptNo, rollNo, reason, feeHeadIds } = data;

  // 1. Check if any of these feeHeads were already recalled
  const alreadyRecalled = await ReceiptRecallRequest.findOne({
    receiptNo,
    rollNo,
    feeHeadIds: { $in: feeHeadIds },
  });
  if (alreadyRecalled) {
    throw new AppError(
      `One or more fee heads have already been recalled for receipt '${receiptNo}'`,
      409
    );
  }

  // 2. Find the student's transaction document
  const transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    throw new AppError("No transactions found for this student", 404);
  }

  // 3. Find the specific receipt
  const receipt = transactionDoc.transactions.find(t => t.receiptNo === receiptNo);
  if (!receipt) {
    throw new AppError(`Receipt '${receiptNo}' not found for student ${rollNo}`, 404);
  }

  // 4. Find each feeHead by ID across all breakdowns in the receipt
  const targetFeeHeads = []; // { feeHead, parentBreakdown }
  for (const fhId of feeHeadIds) {
    let found = false;
    for (const bd of receipt.breakdowns) {
      const fh = bd.feeHeads.find(f => f._id.toString() === fhId);
      if (fh) {
        targetFeeHeads.push({ feeHead: fh, parentBreakdown: bd });
        found = true;
        break;
      }
    }
    if (!found) {
      throw new AppError(`FeeHead '${fhId}' not found in receipt '${receiptNo}'`, 404);
    }
  }

  // 5. Snapshot the target feeHeads for audit (include parent breakdown context)
  const feeHeadSnapshots = targetFeeHeads.map(({ feeHead, parentBreakdown }) => ({
    ...feeHead.toObject(),
    academicYear: parentBreakdown.academicYear,
    semesterNumber: parentBreakdown.semesterNumber,
  }));

  // 6. Fetch student info snapshot + fee tracking
  const [tracking, studentDoc] = await Promise.all([
    StudentFeeTracking.findOne({ rollNo }),
    Student.findOne(
      { "personal.rollNo": rollNo },
      { "personal.studentName": 1, "personal.studentPhoto": 1, "academic.departmentName": 1, "academic.section": 1, "academic.currentAcademicYear": 1, "academic.yearStudying": 1, "academic.currentSemesterNumber": 1 }
    ).lean(),
  ]);
  const studentInfo = {
    studentName: studentDoc?.personal?.studentName || null,
    studentPhoto: studentDoc?.personal?.studentPhoto || null,
    departmentName: studentDoc?.academic?.departmentName || null,
    section: studentDoc?.academic?.section || null,
    currentAcademicYear: studentDoc?.academic?.currentAcademicYear || null,
    yearStudying: studentDoc?.academic?.yearStudying || null,
    currentSemesterNumber: studentDoc?.academic?.currentSemesterNumber || null,
  };
  if (!tracking) throw new AppError("Fee tracking not found for student", 404);

  // 7. Reverse fee tracking per recalled feeHead
  const academicTypes = new Set(["tuition", "exam", "erp", "book", "lab"]);

  for (const { feeHead, parentBreakdown } of targetFeeHeads) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === parentBreakdown.academicYear);
    if (!yearRecord) continue;

    if (academicTypes.has(feeHead.type) && parentBreakdown.semesterNumber) {
      const semSlot = parentBreakdown.semesterNumber % 2 === 1 ? "odd" : "even";
      const sem = yearRecord.academic?.[semSlot];

      if (sem && sem[feeHead.type]) {
        sem[feeHead.type].paid = normalizeMoney(Math.max(0, (sem[feeHead.type].paid || 0) - feeHead.fee));
        setStatus(sem[feeHead.type]);

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

    } else if (feeHead.type === "hostel" && yearRecord.hostel?.total) {
      yearRecord.hostel.total.paid = normalizeMoney(
        Math.max(0, (yearRecord.hostel.total.paid || 0) - feeHead.fee)
      );
      setStatus(yearRecord.hostel.total);

    } else if (feeHead.type === "transport" && yearRecord.transport?.total) {
      yearRecord.transport.total.paid = normalizeMoney(
        Math.max(0, (yearRecord.transport.total.paid || 0) - feeHead.fee)
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

  // 8. Remove recalled feeHeads from their respective breakdowns
  const recalledFhIdSet = new Set(feeHeadIds.map(String));
  for (const bd of receipt.breakdowns) {
    bd.feeHeads = bd.feeHeads.filter(fh => !recalledFhIdSet.has(fh._id.toString()));
    bd.total = normalizeMoney(bd.feeHeads.reduce((sum, fh) => sum + fh.fee, 0));
  }

  // 9. Prune empty breakdowns
  receipt.breakdowns = receipt.breakdowns.filter(bd => bd.feeHeads.length > 0);

  // Capture receipt metadata before possible removal
  const receiptIdCapture = receipt._id;
  const receiptMeta = {
    paymentType: receipt.paymentType,
    bankName: receipt.bankName,
    bankLocation: receipt.bankLocation,
    billingDate: receipt.billingDate,
  };

  // 10. If all breakdowns gone, remove entire receipt
  if (receipt.breakdowns.length === 0) {
    const receiptIndex = transactionDoc.transactions.findIndex(t => t.receiptNo === receiptNo);
    transactionDoc.transactions.splice(receiptIndex, 1);
  } else {
    receipt.totalAmount = normalizeMoney(receipt.breakdowns.reduce((sum, b) => sum + (b.total || 0), 0));
  }

  // 11. Save all documents
  tracking.markModified("academicYearWiseRecord");
  await tracking.save();
  await transactionDoc.save();

  // 12. Create the recall record
  const totalRecalled = normalizeMoney(targetFeeHeads.reduce((sum, { feeHead }) => sum + feeHead.fee, 0));
  const recallRecord = await ReceiptRecallRequest.create({
    receiptId: receiptIdCapture || transactionDoc._id,
    receiptNo,
    rollNo,
    feeHeadIds,
    reason,
    feeHeadSnapshots,
    paymentType: receiptMeta.paymentType,
    bankName: receiptMeta.bankName || null,
    bankLocation: receiptMeta.bankLocation || null,
    billingDate: receiptMeta.billingDate || null,
    totalAmount: totalRecalled,
    studentInfo,
    recalledBy: userId,
  });

  // 13. Audit log
  await ActivityLog.create({
    user: userId,
    endpoint: "/api/receiptRecall",
    method: "POST",
    module: "receiptRecall",
    description: `FeeHead(s) recalled from receipt ${receiptNo} (student: ${rollNo})`,
    after: {
      recallId: recallRecord._id,
      receiptNo,
      rollNo,
      feeHeadIds,
      reason,
    },
  });

  return recallRecord;
};
/* ===================================================================
   GET RECALL RECORDS
=================================================================== */
const getRecalls = async (query) => {
  const { rollNo, receiptNo, page, limit } = query;

  const filter = {};
  if (rollNo) filter.rollNo = rollNo;
  if (receiptNo) filter.receiptNo = receiptNo;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";
  const limitNum = hasLimit ? Math.min(500, Math.max(1, parseInt(limit) || 20)) : 0;

  const totalCount = await ReceiptRecallRequest.countDocuments(filter);

  let dbQuery = ReceiptRecallRequest.find(filter).sort({ createdAt: -1 });

  if (hasLimit) {
    dbQuery = dbQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
  }

  const records = await dbQuery.lean();

  return {
    records,
    pagination: {
      total: totalCount,
      page: hasLimit ? pageNum : 1,
      limit: hasLimit ? limitNum : totalCount,
      totalPages: hasLimit && limitNum > 0 ? Math.ceil(totalCount / limitNum) : 1,
    },
  };
};

module.exports = {
  createRecall,
  getRecalls,
};
