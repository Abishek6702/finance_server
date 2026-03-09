const StudentTransaction = require("./model.studentTransaction");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");
const ReceiptCounter = require("./model.receiptCounter");
const FeeStructureMaster = require("../feeStructure/acadamic/model.acadamic");
const AppError = require("../../utils/AppError");

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

const setStatus = (target) => {
  if (!target) return;
  if (target.total === 0) target.status = "Paid";
  else if (target.paid >= target.total) target.status = "Paid";
  else if (target.paid > 0) target.status = "Partially Paid";
  else target.status = "Unpaid";
};

const createPayment = async (data) => {
  const { rollNo, paymentType, bankName, bankLocation, billingDate, remarks, breakdowns } = data;
  const { receiptNo } = await getNextReceiptNo();
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
              `${field} payment ₹${payAmount} exceeds remaining concession-adjusted due ₹${remaining} for Semester ${bd.academic.semesterNumber} (${bd.academicYear})`, 400
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
          `Hostel payment ₹${bd.hostel} exceeds remaining concession-adjusted due ₹${hostelRemaining} for ${bd.academicYear}`, 400
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
          `Transport payment ₹${bd.transport} exceeds remaining concession-adjusted due ₹${transportRemaining} for ${bd.academicYear}`, 400
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
    billingDate: parseBillingDate(billingDate),
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

  const docObj = transactionDoc.toObject();
  docObj.transactions = docObj.transactions.map(tx => ({
    ...tx,
    breakdowns: reshapeBreakdowns(tx.breakdowns)
  }));
  return docObj;
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

  pipeline.push({ $sort: { "transactions.paidOn": -1 } });

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
        transaction: { ...item.transaction, breakdowns: reshapeBreakdowns(item.transaction?.breakdowns) }
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
      transaction: { ...item.transaction, breakdowns: reshapeBreakdowns(item.transaction?.breakdowns) }
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
    dateMatch["transactions.paidOn"] = {};
    if (fromDate) dateMatch["transactions.paidOn"]["$gte"] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateMatch["transactions.paidOn"]["$lte"] = endDate;
    }
  }

  if (Object.keys(dateMatch).length > 0) {
    pipeline.push({ $match: dateMatch });
  }

  pipeline.push({ $sort: { "transactions.paidOn": -1 } });

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
const getNextReceiptNo = async () => {
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
  );

  const countStr = String(counter.sequence).padStart(3, "0");

  return {
    receiptNo: `REC-${dateStr}-${countStr}`
  };
};


module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
};
