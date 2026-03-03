const StudentTransaction = require("./model.studentTransaction");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");
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

const createPayment = async (data) => {
  const { rollNo, receiptNo, paymentType, bankName, bankLocation, remarks, breakdowns } = data;

  const tracking = await StudentFeeTracking.findOne({ rollNo });
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  /* ===================================================================
     STEP 1: VALIDATE ALL PAYMENT AMOUNTS BEFORE PROCESSING
     - No component should exceed its remaining due
     - Total payment must be > 0
     - Transaction is created ONLY if all validations pass
  =================================================================== */

  let grandTotal = 0;

  // Track proposed academic payments per year to validate against net total (after concessions)
  const proposedAcademicByYear = {};

  // Detect duplicate breakdowns for same year+semester/hostel/transport in one request
  const seenAcademicKeys = new Set();
  const seenHostelKeys = new Set();
  const seenTransportKeys = new Set();

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) throw new AppError(`Academic year ${bd.academicYear} not found in fee tracking`, 404);

    // Reject academic fees without a semesterNumber — they'd be recorded but never tracked
    if (bd.academic && !bd.academic.semesterNumber) {
      const hasAcademicFees = ['tuition', 'exam', 'erp', 'book', 'lab'].some(
        f => normalizeMoney(bd.academic[f] || 0) > 0
      );
      if (hasAcademicFees) {
        throw new AppError("semesterNumber is required when academic fee amounts are provided", 400);
      }
    }

    // Validate academic fee components
    if (bd.academic && bd.academic.semesterNumber) {
      const academicKey = `${bd.academicYear}-sem${bd.academic.semesterNumber}`;
      if (seenAcademicKeys.has(academicKey)) {
        throw new AppError(
          `Duplicate breakdown for semester ${bd.academic.semesterNumber} in ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenAcademicKeys.add(academicKey);
      const semSlot = bd.academic.semesterNumber % 2 === 1 ? 'odd' : 'even';
      const sem = yearRecord.academic?.[semSlot];
      if (!sem) throw new AppError(`Semester ${bd.academic.semesterNumber} not found in tracking for ${bd.academicYear}`, 404);

      // Ensure the semester number matches the one stored in this academic year
      if (sem.semesterNumber !== bd.academic.semesterNumber) {
        throw new AppError(
          `Semester ${bd.academic.semesterNumber} does not belong to academic year ${bd.academicYear}. ` +
          `This year has semester ${sem.semesterNumber} in the ${semSlot} slot.`, 400
        );
      }

      const fields = ['tuition', 'exam', 'erp', 'book', 'lab'];
      let semAcademicPayment = 0;
      for (const field of fields) {
        const payAmount = normalizeMoney(bd.academic[field] || 0);
        if (payAmount > 0) {
          const total = normalizeMoney(sem[field]?.total || 0);
          const paid = normalizeMoney(sem[field]?.paid || 0);
          const remaining = normalizeMoney(total - paid);
          if (payAmount > remaining) {
            throw new AppError(
              `${field} payment ₹${payAmount} exceeds remaining due ₹${remaining} for semester ${bd.academic.semesterNumber} in ${bd.academicYear}`, 400
            );
          }
          grandTotal += payAmount;
          semAcademicPayment += payAmount;
        }
      }
      proposedAcademicByYear[bd.academicYear] = normalizeMoney(
        (proposedAcademicByYear[bd.academicYear] || 0) + semAcademicPayment
      );
    }

    // Validate hostel payment
    if (bd.hostel && normalizeMoney(bd.hostel) > 0) {
      if (seenHostelKeys.has(bd.academicYear)) {
        throw new AppError(
          `Duplicate hostel payment for ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenHostelKeys.add(bd.academicYear);
      if (!yearRecord.hostel) throw new AppError(`No hostel fee record found for ${bd.academicYear}`, 404);
      const hostelRemaining = normalizeMoney(
        (yearRecord.hostel.total?.total || 0) - (yearRecord.hostel.total?.paid || 0)
      );
      if (normalizeMoney(bd.hostel) > hostelRemaining) {
        throw new AppError(
          `Hostel payment ₹${bd.hostel} exceeds remaining due ₹${hostelRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.hostel);
    }

    // Validate transport payment
    if (bd.transport && normalizeMoney(bd.transport) > 0) {
      if (seenTransportKeys.has(bd.academicYear)) {
        throw new AppError(
          `Duplicate transport payment for ${bd.academicYear}. Combine amounts into a single breakdown.`, 400
        );
      }
      seenTransportKeys.add(bd.academicYear);
      if (!yearRecord.transport) throw new AppError(`No transport fee record found for ${bd.academicYear}`, 404);
      const transportRemaining = normalizeMoney(
        (yearRecord.transport.total?.total || 0) - (yearRecord.transport.total?.paid || 0)
      );
      if (normalizeMoney(bd.transport) > transportRemaining) {
        throw new AppError(
          `Transport payment ₹${bd.transport} exceeds remaining due ₹${transportRemaining} for ${bd.academicYear}`, 400
        );
      }
      grandTotal += normalizeMoney(bd.transport);
    }
  }

  // Validate proposed academic payments against the net academic total (post-concession) per year
  for (const [academicYear, proposedAmount] of Object.entries(proposedAcademicByYear)) {
    if (proposedAmount <= 0) continue;
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === academicYear);
    if (!yearRecord?.academic) continue;
    const netAcademicTotal = normalizeMoney(yearRecord.academic.total?.total || 0);
    const alreadyPaid = normalizeMoney(yearRecord.academic.total?.paid || 0);
    const academicRemaining = normalizeMoney(netAcademicTotal - alreadyPaid);
    if (proposedAmount > academicRemaining) {
      throw new AppError(
        `Academic payment ₹${proposedAmount} exceeds net remaining due ₹${academicRemaining} for ${academicYear} (after concessions)`, 400
      );
    }
  }

  // Reject zero-amount payments
  if (grandTotal <= 0) {
    throw new AppError("Total payment amount must be greater than 0", 400);
  }

  /* ===================================================================
     STEP 2: ALL VALIDATIONS PASSED – Create transaction record
  =================================================================== */

  let transactionDoc = await StudentTransaction.findOne({ rollNo });
  if (!transactionDoc) {
    const student = await Student.findOne({ "personal.rollNo": rollNo });
    if (!student) throw new AppError("Student not found", 404);
    transactionDoc = new StudentTransaction({
      student: student._id,
      rollNo,
      transactions: []
    });
  }

  // Reject duplicate receipt numbers
  const receiptExists = transactionDoc.transactions.some(t => t.receiptNo === receiptNo);
  if (receiptExists) {
    throw new AppError(`Receipt number '${receiptNo}' has already been used for this student`, 400);
  }

  const mappedBreakdowns = breakdowns.map(bd => {
    const academic = bd.academic || {};
    let academicTotal = 0;
    academicTotal += normalizeMoney(academic.tuition || 0)
      + normalizeMoney(academic.exam || 0)
      + normalizeMoney(academic.erp || 0)
      + normalizeMoney(academic.book || 0)
      + normalizeMoney(academic.lab || 0);

    const total = normalizeMoney(academicTotal + normalizeMoney(bd.hostel || 0) + normalizeMoney(bd.transport || 0));

    return {
      academicYear: bd.academicYear,
      academic: {
        semesterNumber: academic.semesterNumber,
        tuition: normalizeMoney(academic.tuition || 0),
        exam: normalizeMoney(academic.exam || 0),
        erp: normalizeMoney(academic.erp || 0),
        book: normalizeMoney(academic.book || 0),
        lab: normalizeMoney(academic.lab || 0)
      },
      hostel: normalizeMoney(bd.hostel || 0),
      transport: normalizeMoney(bd.transport || 0),
      total
    };
  });

  transactionDoc.transactions.push({
    receiptNo,
    paymentType,
    bankName,
    bankLocation,
    remarks,
    breakdowns: mappedBreakdowns
  });

  await transactionDoc.save();

  for (const bd of breakdowns) {
    const yearRecord = tracking.academicYearWiseRecord.find(r => r.academicYear === bd.academicYear);
    if (!yearRecord) continue;

    const addPayment = (target, amount) => {
      if (!target || !amount) return;

      const increment = normalizeMoney(amount);
      target.total = normalizeMoney(target.total || 0);
      target.paid = normalizeMoney((target.paid || 0) + increment);
      target.paid = Math.min(target.paid, target.total);
      setStatus(target);
    };

    if (bd.academic && bd.academic.semesterNumber) {
      const sem = bd.academic.semesterNumber % 2 === 1 ? yearRecord.academic.odd : yearRecord.academic.even;
      if (sem) {
        addPayment(sem.tuition, bd.academic.tuition);
        addPayment(sem.exam, bd.academic.exam);
        addPayment(sem.erp, bd.academic.erp);
        addPayment(sem.book, bd.academic.book);
        addPayment(sem.lab, bd.academic.lab);

        const semPaid = normalizeMoney((sem.tuition?.paid || 0) + (sem.exam?.paid || 0) + (sem.erp?.paid || 0) + (sem.book?.paid || 0) + (sem.lab?.paid || 0));
        sem.total.paid = Math.min(semPaid, normalizeMoney(sem.total.total || 0));
        setStatus(sem.total);
      }

      const termTotalPaid = normalizeMoney((yearRecord.academic.odd?.total?.paid || 0) + (yearRecord.academic.even?.total?.paid || 0));
      yearRecord.academic.total.paid = Math.min(termTotalPaid, normalizeMoney(yearRecord.academic.total.total || 0));
      setStatus(yearRecord.academic.total);
    }

    if (bd.hostel && yearRecord.hostel) {
      addPayment(yearRecord.hostel.total, bd.hostel);
    }
    if (bd.transport && yearRecord.transport) {
      addPayment(yearRecord.transport.total, bd.transport);
    }

    const yearPaid = normalizeMoney((yearRecord.academic.total?.paid || 0) + (yearRecord.hostel?.total?.paid || 0) + (yearRecord.transport?.total?.paid || 0));
    yearRecord.total.paid = Math.min(yearPaid, normalizeMoney(yearRecord.total.total || 0));
    setStatus(yearRecord.total);
  }

  tracking.markModified("academicYearWiseRecord");
  await tracking.save();

  return transactionDoc;
};
 
/**
 * GET /
 * Returns all transactions with student details.
 * Filters: department, paymentMode, fromDate, toDate
 * Pagination: page, limit (default: all)
 * Sorted: newest first
 */
const getAllTransactions = async (query) => {
  const { department, paymentMode, fromDate, toDate, page, limit } = query;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";
  const limitNum = hasLimit ? Math.min(500, Math.max(1, parseInt(limit) || 20)) : 0;

  const pipeline = [];

  // Unwind transactions to work with individual payments
  pipeline.push({ $unwind: "$transactions" });

  // Build match filters on transaction-level fields
  const matchStage = {};

  if (paymentMode) {
    matchStage["transactions.paymentType"] = paymentMode;
  }

  if (fromDate || toDate) {
    matchStage["transactions.paidOn"] = {};
    if (fromDate) matchStage["transactions.paidOn"]["$gte"] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      matchStage["transactions.paidOn"]["$lte"] = endDate;
    }
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Join with Student collection for student data
  pipeline.push({
    $lookup: {
      from: "students",
      localField: "student",
      foreignField: "_id",
      as: "studentData"
    }
  });
  pipeline.push({ $unwind: "$studentData" });

  // Filter by department (from student data)
  if (department) {
    pipeline.push({
      $match: { "studentData.academic.departmentName": department }
    });
  }

  // Sort by payment date descending (newest first)
  pipeline.push({ $sort: { "transactions.paidOn": -1 } });

  // Shape output
  const projectStage = {
    $project: {
      _id: 0,
      rollNo: 1,
      transaction: "$transactions",
      student: {
        _id: "$studentData._id",
        personal: "$studentData.personal",
        academic: "$studentData.academic",
        contact: "$studentData.contact"
      }
    }
  };

  // Use $facet for efficient count + data in one query
  if (hasLimit) {
    const facetPipeline = {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          projectStage
        ]
      }
    };
    pipeline.push(facetPipeline);

    const [result] = await StudentTransaction.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;

    return {
      transactions: result.data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  // No limit — return all results
  pipeline.push(projectStage);
  const results = await StudentTransaction.aggregate(pipeline);

  return {
    transactions: results,
    pagination: {
      total: results.length,
      page: 1,
      limit: results.length,
      totalPages: 1
    }
  };
};

/**
 * GET /:rollNo
 * Returns complete transactions for one student.
 * Features: pagination, newest first, optional date filter, receipt breakdown
 */
const getStudentTransactions = async (rollNo, query = {}) => {
  const { fromDate, toDate, page, limit } = query;

  const student = await Student.findOne({ "personal.rollNo": rollNo }).lean();
  if (!student) throw new AppError("Student not found", 404);

  const txnDoc = await StudentTransaction.findOne({ rollNo }).lean();

  let transactions = txnDoc?.transactions ? [...txnDoc.transactions] : [];

  // Filter by date range
  if (fromDate || toDate) {
    transactions = transactions.filter((t) => {
      const paidOn = new Date(t.paidOn);
      if (fromDate && paidOn < new Date(fromDate)) return false;
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        if (paidOn > endDate) return false;
      }
      return true;
    });
  }

  // Sort newest first
  transactions.sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

  // Pagination
  const total = transactions.length;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";
  const limitNum = hasLimit ? Math.min(500, Math.max(1, parseInt(limit) || 20)) : total;

  const start = (pageNum - 1) * limitNum;
  const paginatedTransactions = hasLimit ? transactions.slice(start, start + limitNum) : transactions;

  return {
    student: {
      personal: student.personal,
      academic: student.academic,
      contact: student.contact
    },
    transactions: paginatedTransactions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1
    }
  };
};

/**
 * GET /nextReceiptNo
 * Returns the next unique receipt number for today.
 * Format: REC-YYYYMMDD-NNN (e.g. REC-20260302-001)
 * NNN = count of today's receipts + 1
 * NOTE: This format function will be changed in the future.
 */
const getNextReceiptNo = async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Count all receipts created today across all students
  const result = await StudentTransaction.aggregate([
    { $unwind: "$transactions" },
    { $match: { "transactions.paidOn": { $gte: startOfDay, $lte: endOfDay } } },
    { $count: "count" }
  ]);

  const todayCount = result.length > 0 ? result[0].count : 0;
  const nextCount = todayCount + 1;

  // Format date as YYYYMMDD
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  // Format count as 3-digit padded number
  const countStr = String(nextCount).padStart(3, "0");

  return { receiptNo: `REC-${dateStr}-${countStr}` };
};

module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
  getNextReceiptNo,
};
