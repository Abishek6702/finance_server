const mongoose = require("mongoose");
const ReceiptRecallRequest = require("./model.receiptRecall");
const StudentTransaction = require("../transaction/model.studentTransaction");
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
   CREATE RECALL — Admin directly recalls specific breakdowns
   • Reverses payment allocations in fee tracking
   • Removes the recalled breakdowns from the transaction receipt
   • If all breakdowns are recalled, removes the entire receipt
=================================================================== */
const createRecall = async (data, userId) => {
  const { receiptNo, rollNo, reason, breakdownIds } = data;

  // 1. Check if any of these breakdowns were already recalled
  const alreadyRecalled = await ReceiptRecallRequest.findOne({
    receiptNo,
    rollNo,
    breakdownIds: { $in: breakdownIds },
  });
  if (alreadyRecalled) {
    throw new AppError(
      `One or more breakdowns have already been recalled for receipt '${receiptNo}'`,
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

  // 4. Find the target breakdowns within the receipt
  const targetBreakdowns = [];
  for (const bdId of breakdownIds) {
    const bd = receipt.breakdowns.find(b => b._id.toString() === bdId);
    if (!bd) {
      throw new AppError(`Breakdown '${bdId}' not found in receipt '${receiptNo}'`, 404);
    }
    targetBreakdowns.push(bd);
  }

  // 5. Snapshot the target breakdowns for audit
  const breakdownSnapshots = targetBreakdowns.map(bd => bd.toObject());

  // 6. Fetch student info snapshot + reverse payment allocations in fee tracking
  const [tracking, studentDoc] = await Promise.all([
    StudentFeeTracking.findOne({ rollNo }),
    Student.findOne(
      { "personal.rollNo": rollNo },
      { "academic.departmentName": 1, "academic.currentAcademicYear": 1, "academic.yearStudying": 1, "academic.currentSemesterNumber": 1 }
    ).lean(),
  ]);
  const studentInfo = {
    departmentName: studentDoc?.academic?.departmentName || null,
    currentAcademicYear: studentDoc?.academic?.currentAcademicYear || null,
    yearStudying: studentDoc?.academic?.yearStudying || null,
    currentSemesterNumber: studentDoc?.academic?.currentSemesterNumber || null,
  };
  if (!tracking) throw new AppError("Fee tracking not found for student", 404);

  for (const bd of targetBreakdowns) {
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

  // 7. Remove the recalled breakdowns from the receipt
  const recalledIdSet = new Set(breakdownIds.map(String));
  receipt.breakdowns = receipt.breakdowns.filter(b => !recalledIdSet.has(b._id.toString()));

  // 8. If all breakdowns are gone, remove the entire receipt
  if (receipt.breakdowns.length === 0) {
    const receiptIndex = transactionDoc.transactions.findIndex(t => t.receiptNo === receiptNo);
    transactionDoc.transactions.splice(receiptIndex, 1);
  } else {
    // Recalculate receipt totalAmount
    receipt.totalAmount = receipt.breakdowns.reduce((sum, b) => sum + (b.total || 0), 0);
  }

  // 9. Save all documents
  tracking.markModified("academicYearWiseRecord");
  await tracking.save();
  await transactionDoc.save();

  // 10. Create the recall record (preserve receipt metadata even if receipt is fully removed)
  const recallRecord = await ReceiptRecallRequest.create({
    receiptId: receipt._id || transactionDoc._id,
    receiptNo,
    rollNo,
    breakdownIds,
    reason,
    breakdownSnapshots,
    paymentType: receipt.paymentType,
    bankName: receipt.bankName || null,
    bankLocation: receipt.bankLocation || null,
    billingDate: receipt.billingDate || null,
    remarks: receipt.remarks || null,
    totalAmount: receipt.totalAmount || 0,
    studentInfo,
    recalledBy: userId,
  });

  // 11. Audit log
  await ActivityLog.create({
    user: userId,
    endpoint: "/api/receiptRecall",
    method: "POST",
    module: "receiptRecall",
    description: `Breakdown(s) recalled from receipt ${receiptNo} (student: ${rollNo})`,
    after: {
      recallId: recallRecord._id,
      receiptNo,
      rollNo,
      breakdownIds,
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
