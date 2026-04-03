const StudentTransaction = require("./model/modelStudentFeePayments");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");
const ReceiptCounter = require("./model/modelReceiptCounter");
const mongoose = require("mongoose");
const AppError = require("../../../utils/appError");

const parseBillingDate = (billingDate) => {
  if (!billingDate) return new Date();
  // Support dd/mm/yyyy format
  if (typeof billingDate === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(billingDate)) {
    const [dd, mm, yyyy] = billingDate.split('/');
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d;
  }
  // Support ISO string or Date object
  const d = new Date(billingDate);
  if (!isNaN(d.getTime())) return d;
  return new Date();
};

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

const reshapeBreakdowns = (breakdowns) =>
  (breakdowns || []).map((bd) => {
    const { _id, feeHeads, ...rest } = bd;
    return {
      ...rest,
      feeHeads: (feeHeads || []).reduce((map, fh) => {
        map[fh.type] = { fee: fh.fee, _id: fh._id };
        return map;
      }, {}),
    };
  });

const normalizeReductionReasonId = (value) => (value ? String(value) : null);

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partial";
  else target.status = "Unpaid";
};

const createPayment = async (data, options = {}) => {
  const { session = null } = options;
  const { rollNo, paymentType, bankName, bankLocation, billingDate, breakdowns, excessAmount, reductionId } = data;
  if (paymentType === "reduction" && !mongoose.Types.ObjectId.isValid(reductionId)) {
    throw new AppError("reductionId is required as a valid MongoDB ObjectId when paymentType is reduction", 400);
  }
  const { receiptNo } = await getNextReceiptNo({ session });
  const tracking = await StudentFeeTracking.findOne({ rollNo }).session(session);
  if (!tracking) throw new AppError("Fee tracking not found for this student", 404);

  const isExcessPayment = paymentType === "excessAmount";
  const topUpAmount = normalizeMoney(excessAmount || 0);
  let studentDoc = null;
  let availableExcess = 0;

  if (isExcessPayment || topUpAmount > 0) {
    studentDoc = await Student.findOne({ "personal.rollNo": rollNo }).session(session);
    if (!studentDoc) throw new AppError("Student not found", 404);

    const currentExcess = normalizeMoney(studentDoc.enrollment?.excessAmount || 0);
    availableExcess = normalizeMoney(currentExcess + topUpAmount);

    if (isExcessPayment && availableExcess <= 0) {
      throw new AppError("Excess amount is not available for this student", 400);
    }
  }

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

    // Reject academic fees without a semesterNumber; they'd be recorded but never tracked
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
              `${field} payment INR ${payAmount} exceeds remaining concession-adjusted due INR ${remaining} for Semester ${bd.academic.semesterNumber} (${bd.academicYear})`, 400
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
      if (yearRecord.hostel.isActive === false) {
        throw new AppError(`Cannot process hostel payment for ${bd.academicYear} as the facility is inactive`, 400);
      }
      const hostelRemaining = normalizeMoney(
        (yearRecord.hostel.total?.total || 0) - (yearRecord.hostel.total?.paid || 0)
      );
      if (normalizeMoney(bd.hostel) > hostelRemaining) {
        throw new AppError(
          `Hostel payment INR ${bd.hostel} exceeds remaining concession-adjusted due INR ${hostelRemaining} for ${bd.academicYear}`, 400
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
      if (yearRecord.transport.isActive === false) {
        throw new AppError(`Cannot process transport payment for ${bd.academicYear} as the facility is inactive`, 400);
      }
      const transportRemaining = normalizeMoney(
        (yearRecord.transport.total?.total || 0) - (yearRecord.transport.total?.paid || 0)
      );
      if (normalizeMoney(bd.transport) > transportRemaining) {
        throw new AppError(
          `Transport payment INR ${bd.transport} exceeds remaining concession-adjusted due INR ${transportRemaining} for ${bd.academicYear}`, 400
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
        `Academic payment INR ${proposedAmount} exceeds net remaining due INR ${academicRemaining} for ${academicYear} (after concessions)`, 400
      );
    }
  }

  // Reject zero-amount payments
  if (grandTotal <= 0) {
    throw new AppError("Total payment amount must be greater than 0", 400);
  }

  if (isExcessPayment && availableExcess < grandTotal) {
    throw new AppError(
      `Excess amount INR ${availableExcess} is insufficient to cover total payable INR ${grandTotal}`,
      400
    );
  }

  /* ===================================================================
     STEP 2: ALL VALIDATIONS PASSED G�� Create transaction record
  =================================================================== */

  let transactionDoc = await StudentTransaction.findOne({ rollNo }).session(session);
  if (!transactionDoc) {
    const student = studentDoc || await Student.findOne({ "personal.rollNo": rollNo }).session(session);
    if (!student) throw new AppError("Student not found", 404);
    transactionDoc = new StudentTransaction({
      student: student._id,
      rollNo,
      transactions: []
    });
  }
 

  const mappedBreakdowns = breakdowns.map(bd => {
    const academic = bd.academic || {};
    const feeHeads = [];

    for (const field of ["tuition", "exam", "erp", "book", "lab"]) {
      const fee = normalizeMoney(academic[field] || 0);
      if (fee > 0) feeHeads.push({ type: field, fee });
    }

    const hostelFee = normalizeMoney(bd.hostel || 0);
    if (hostelFee > 0) feeHeads.push({ type: "hostel", fee: hostelFee });

    const transportFee = normalizeMoney(bd.transport || 0);
    if (transportFee > 0) feeHeads.push({ type: "transport", fee: transportFee });

    const total = normalizeMoney(feeHeads.reduce((sum, fh) => sum + fh.fee, 0));

    return {
      academicYear: bd.academicYear,
      semesterNumber: academic.semesterNumber || null,
      feeHeads,
      total
    };
  });

transactionDoc.transactions.push({
  receiptNo,
  paymentType,
  bankName,
  bankLocation,
  reductionId: paymentType === "reduction" ? reductionId : null,
  billingDate: parseBillingDate(billingDate),
  createdAt: new Date(), // mongo transaction time
  breakdowns: mappedBreakdowns
});

  await transactionDoc.save({ session });

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
  await tracking.save({ session });

  if (studentDoc) {
    const newExcess = isExcessPayment
      ? normalizeMoney(availableExcess - grandTotal)
      : normalizeMoney(availableExcess);
    studentDoc.enrollment.excessAmount = newExcess;
    studentDoc.enrollment.isExcessAmountTrue = newExcess > 0;
    await studentDoc.save({ session });
  }

  const docObj = transactionDoc.toObject();
  docObj.transactions = docObj.transactions.map(tx => ({
    ...tx,
    breakdowns: reshapeBreakdowns(tx.breakdowns)
  }));
  return receiptNo;
};
  




/* ============================================================
   PAGINATION CONSTANTS (DRY)
============================================================ */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

const getPagination = (page, limit) => {
  const pageNum =
    Number.isInteger(Number(page)) && Number(page) > 0
      ? Number(page)
      : DEFAULT_PAGE;

  const limitNum =
    Number.isInteger(Number(limit)) && Number(limit) > 0
      ? Math.min(Number(limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const skip = (pageNum - 1) * limitNum;

  return { pageNum, limitNum, skip };
};



/* ============================================================
   GET ALL TRANSACTIONS
============================================================ */
const getAllTransactions = async (query) => {
  const { department, paymentMode, fromDate, toDate, page, limit } = query;

  const { pageNum, limitNum, skip } = getPagination(page, limit);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";

  const pipeline = [];

  pipeline.push({ $unwind: "$transactions" });

  const matchStage = {};

  if (paymentMode) {
    matchStage["transactions.paymentType"] = paymentMode;
  }

  if (fromDate || toDate) {
    matchStage["transactions.billingDate"] = {};
    if (fromDate) matchStage["transactions.billingDate"]["$gte"] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      matchStage["transactions.billingDate"]["$lte"] = endDate;
    }
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push({
    $lookup: {
      from: "students",
      let: { studentId: "$student" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$studentId"] } } },
        ...(department
          ? [{ $match: { "academic.departmentName": department } }]
          : []),
        {
          $project: {
          _id: 0,
          "personal.rollNo": 1,
          "personal.studentName": 1,
          "personal.studentPhoto": 1,
          "personal.registerNumber": 1,
          "academic.departmentName": 1,
          "academic.section": 1,
          "academic.yearStudying": 1
          }
        }
      ],
      as: "student"
    }
  });

  pipeline.push({ $unwind: "$student" });

  pipeline.push({ $sort: { "transactions.createdAt": -1 } });

  const projectStage = {
    $project: {
      _id: 0,
      student: 1,
      transaction: "$transactions"
    }
  };

  if (hasLimit) {
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limitNum },
          projectStage
        ]
      }
    });

    const [result] = await StudentTransaction.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;

    return {
      transactions: result.data.map(item => ({
        ...item,
        transaction: {
          ...item.transaction,
          reductionReasonId: normalizeReductionReasonId(item.transaction?.reductionId),
          breakdowns: reshapeBreakdowns(item.transaction?.breakdowns)
        }
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  pipeline.push(projectStage);
  const results = await StudentTransaction.aggregate(pipeline);

  return {
    transactions: results.map(item => ({
      ...item,
      transaction: {
        ...item.transaction,
        reductionReasonId: normalizeReductionReasonId(item.transaction?.reductionId),
        breakdowns: reshapeBreakdowns(item.transaction?.breakdowns)
      }
    })),
    pagination: {
      total: results.length,
      page: 1,
      limit: results.length,
      totalPages: 1
    }
  };
};

/* ============================================================
   GET SINGLE STUDENT TRANSACTIONS
============================================================ */
const getStudentTransactions = async (rollNo, query = {}) => {
  const { fromDate, toDate, page, limit } = query;

  const { pageNum, limitNum, skip } = getPagination(page, limit);
  const hasLimit = limit !== undefined && limit !== null && limit !== "";

 const student = await Student.findOne(
  { "personal.rollNo": rollNo },
  {
    "personal.rollNo": 1,
    "personal.studentName": 1,
    "personal.studentPhoto": 1,
    "personal.registerNumber": 1,
    "academic.departmentName": 1,
    "academic.section": 1,
    "academic.yearStudying": 1
  }
).lean();
if (!student) throw new AppError("Student not found", 404);

const studentData = {
  rollNo: student.personal.rollNo,
  name: student.personal.studentName,
  profile: student.personal.studentPhoto,
  registerNo: student.personal.registerNumber,
  department: student.academic.departmentName,
  section: student.academic.section,
  year: student.academic.yearStudying
};

  const pipeline = [
    { $match: { rollNo } },
    { $unwind: "$transactions" }
  ];

  const dateMatch = {};

  if (fromDate || toDate) {
    dateMatch["transactions.billingDate"] = {};
    if (fromDate) dateMatch["transactions.billingDate"]["$gte"] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateMatch["transactions.billingDate"]["$lte"] = endDate;
    }
  }

  if (Object.keys(dateMatch).length > 0) {
    pipeline.push({ $match: dateMatch });
  }

  pipeline.push({ $sort: { "transactions.createdAt": -1 } });

  const projectStage = {
    $project: {
      _id: 0,
      transaction: "$transactions"
    }
  };

  if (hasLimit) {
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limitNum },
          projectStage
        ]
      }
    });

    const [result] = await StudentTransaction.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;

    return {
      studentData,
      transactions: result.data.map(d => ({
        ...d.transaction,
        reductionReasonId: normalizeReductionReasonId(d.transaction?.reductionId),
        breakdowns: reshapeBreakdowns(d.transaction?.breakdowns)
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  pipeline.push(projectStage);
  const results = await StudentTransaction.aggregate(pipeline);

  return {
    student,
    transactions: results.map(r => ({
      ...r.transaction,
      reductionReasonId: normalizeReductionReasonId(r.transaction?.reductionId),
      breakdowns: reshapeBreakdowns(r.transaction?.breakdowns)
    })),
    pagination: {
      total: results.length,
      page: 1,
      limit: results.length,
      totalPages: 1
    }
  };
};
 

/**
 
 * Returns next unique receipt number for today.
 * Format: REC-YYYYMMDD-NNN
 * Uses atomic increment (no race condition).
 */
const getNextReceiptNo = async ({ session = null } = {}) => {
  const now = new Date();

  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  // Atomic increment
  const counter = await ReceiptCounter.findOneAndUpdate(
    { date: dateStr },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true
    }
  ).session(session);

  const countStr = String(counter.sequence).padStart(3, "0");

  return {
    receiptNo: `REC-${dateStr}-${countStr}`
  };
};


/* ============================================================
   GET RECENT TRANSACTIONS (flat: one row per fee head)
============================================================ */
const RECENT_DEFAULT_LIMIT = 10;

const getRecentTransactions = async (query) => {
  const {
    department,
    paymentMode,
    fromDate,
    toDate,
    feeHead,
    search,
    yearStudying,
    rollNo,
    page,
    limit
  } = query;

  const pageNum =
    Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : DEFAULT_PAGE;
  const limitNum =
    Number.isInteger(Number(limit)) && Number(limit) > 0
      ? Math.min(Number(limit), MAX_LIMIT)
      : RECENT_DEFAULT_LIMIT;
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [];

  pipeline.push({ $unwind: "$transactions" });

  // Early date and paymentMode filters (before lookup)
  const earlyMatch = {};

  if (paymentMode) {
    earlyMatch["transactions.paymentType"] = paymentMode;
  }

  if (rollNo) {
    earlyMatch["rollNo"] = rollNo.toUpperCase();
  } 

  if (fromDate || toDate) {
    earlyMatch["transactions.billingDate"] = {};
    if (fromDate) earlyMatch["transactions.billingDate"]["$gte"] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      earlyMatch["transactions.billingDate"]["$lte"] = endDate;
    }
  }

  if (Object.keys(earlyMatch).length > 0) {
    pipeline.push({ $match: earlyMatch });
  }

  // Student lookup with optional department and yearStudying filter
  const studentMatchClauses = [{ $expr: { $eq: ["$_id", "$$studentId"] } }];
  if (department) {
    studentMatchClauses.push({ "academic.departmentName": department });
  }
  if (yearStudying) {
    studentMatchClauses.push({ "academic.yearStudying": Number(yearStudying) });
  }

  pipeline.push({
    $lookup: {
      from: "students",
      let: { studentId: "$student" },
      pipeline: [
        { $match: { $and: studentMatchClauses } },
        {
          $project: {
            _id: 0,
            "personal.rollNo": 1,
            "personal.studentName": 1,
            "personal.studentPhoto": 1,
            "academic.departmentName": 1,
            "academic.yearStudying": 1,
            "academic.section": 1,
            "acadamic.currentAcademicYear": 1,
            "academic.section": 1
          } 
        }
      ],
      as: "student"
    }
  });

  // Drop docs where student didn't match the filter
  pipeline.push({ $unwind: "$student" });

  // Optional search on rollNo
  if (search) {
    pipeline.push({
      $match: {
        "student.personal.rollNo": { $regex: search, $options: "i" }
      }
    });
  }

  // Unwind breakdowns
  pipeline.push({ $unwind: "$transactions.breakdowns" });

  // Unwind feeHeads array directly (model stores [{type, fee}])
  pipeline.push({ $unwind: "$transactions.breakdowns.feeHeads" });

  // Optional feeHead filter
  if (feeHead) {
    pipeline.push({ $match: { "transactions.breakdowns.feeHeads.type": feeHead } });
  }

  pipeline.push({ $sort: { "transactions.createdAt": -1 } });

  const projectStage = {
    $project: {
      _id: 0,
      studentName: "$student.personal.studentName",
      rollNo: "$student.personal.rollNo",
      photo: "$student.personal.studentPhoto",
      department: "$student.academic.departmentName",
      year: "$student.academic.yearStudying", 

      receiptNo: "$transactions.receiptNo",
      paymentMode: "$transactions.paymentType",
      reductionReasonId: "$transactions.reductionId",
      bank: "$transactions.bankName",
      paidOn: "$transactions.billingDate",

      semester: "$transactions.breakdowns.semesterNumber",
      academicYear: "$transactions.breakdowns.academicYear",
      section: "$student.academic.section",
      feeHead: "$transactions.breakdowns.feeHeads.type",
      amount: "$transactions.breakdowns.feeHeads.fee",

      breakdownId: "$transactions.breakdowns.feeHeads._id",
      transactionId: "$transactions._id"
    }
  };

  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skip }, { $limit: limitNum }, projectStage]
    }
  });

  const [result] = await StudentTransaction.aggregate(pipeline);
  const total = result.metadata[0]?.total || 0;

  return {
    transactions: result.data.map((row) => ({
      ...row,
      reductionReasonId: normalizeReductionReasonId(row.reductionReasonId),
    })),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/* ============================================================
   GET BILL BY RECEIPT NUMBER
============================================================ */
const { toWords } = require("number-to-words");

const FEE_HEAD_LABELS = {
  tuition: "Tuition Fee",
  exam: "Exam Fee",
  erp: "ERP Fee",
  book: "Book Fee",
  lab: "Lab Fee",
  hostel: "Hostel Fee",
  transport: "Transport Fee",
};

const DEGREE_LABELS = {
  BE: "B.E",
  BTech: "B.Tech",
  ME: "M.E",
  MTech: "M.Tech",
};

const formatBillingDate = (date) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const toAmountInWords = (amount) => {
  const integer = Math.round(amount);
  if (integer === 0) return "Zero Only";
  const words = toWords(integer);
  const capitalized = words.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${capitalized} Only`;
};

const getBillByReceiptNo = async (receiptNo) => {
  const doc = await StudentTransaction.findOne(
    { "transactions.receiptNo": receiptNo },
    { rollNo: 1, student: 1, "transactions.$": 1 }
  ).lean();

  if (!doc || !doc.transactions || doc.transactions.length === 0) {
    throw new AppError("Receipt not found", 404);
  }

  const tx = doc.transactions[0];

  const student = await Student.findById(doc.student, {
    "personal.rollNo": 1,
    "personal.studentName": 1,
    "academic.departmentName": 1,
    "academic.section": 1,
    "academic.yearStudying": 1,
    "academic.currentSemesterNumber": 1,
    "academic.degreeProgram": 1,
    "academic.academicType": 1
  }).lean();
 
  if (!student) throw new AppError("Associated student not found", 404);

  const breakdownsMap = {};
const ACADEMIC_TYPE_LABEL = {
  REG: "Regular",
  PART_TIME: "Part time"
};

for (const bd of tx.breakdowns || []) {
  for (const fh of bd.feeHeads || []) {

    const label = FEE_HEAD_LABELS[fh.type] || fh.type;

    const academicLabel =
      ACADEMIC_TYPE_LABEL[student.academic.academicType] ||
      student.academic.academicType;

    const key = `${academicLabel} - ${label}`;

    breakdownsMap[key] = normalizeMoney(
      (breakdownsMap[key] || 0) + fh.fee
    );

  }
}

  let paidForSemNumber = null;
  let paidForAcadamicYear = null;
  for (const bd of tx.breakdowns || []) {
    if (!paidForAcadamicYear) paidForAcadamicYear = bd.academicYear || null;
    if (bd.semesterNumber && !paidForSemNumber) paidForSemNumber = bd.semesterNumber;
  }

  const totalAmount = normalizeMoney(tx.totalAmount || 0);
  const isCash = tx.paymentType === "Cash";

  return {
    receiptNo: tx.receiptNo,
    reductionReasonId: normalizeReductionReasonId(tx.reductionId),
    date: formatBillingDate(tx.billingDate),
    studentName: student.personal.studentName || null,
    rollNo: student.personal.rollNo,
    year: student.academic.yearStudying != null ? String(student.academic.yearStudying) : null,
    section: student.academic.section || null,
    department: student.academic.departmentName || null,
    educationType: DEGREE_LABELS[student.academic.degreeProgram] || student.academic.degreeProgram || null,
    studentCurrentSemNumber: student.academic.currentSemesterNumber != null
      ? String(student.academic.currentSemesterNumber)
      : null,
    paidForSemNumber: paidForSemNumber != null ? String(paidForSemNumber) : null,
    paidForAcadamicYear: paidForAcadamicYear || null,
    breakdowns: breakdownsMap,
    cashAmount: isCash ? totalAmount : 0,
    bankAmount: isCash ? 0 : totalAmount,
    totalAmount,
    amountInWords: toAmountInWords(totalAmount),
    bankName: tx.bankName || null,
    bankLocation: tx.bankLocation || null,
  };
};

module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
  getRecentTransactions,
  getBillByReceiptNo
};

