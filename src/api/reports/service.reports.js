const mongoose = require("mongoose");
const StudentTransaction = require("../feePayments/model.studentFeePayments");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const Student = require("../students/model.student");

const normalizeMoney = (val) => Math.round((Number(val) || 0) * 100) / 100;

const formatFeeHeadInfo = (type) => {
  const map = {
    tuition: "Tuition Fees",
    exam: "Exam Fees",
    erp: "ERP Fees",
    book: "Book Fees",
    lab: "Lab Fees"
  };

  if (type === "hostel") {
    return { feeHead: "Hostel Fees", subHead: "-" };
  } else if (type === "transport") {
    return { feeHead: "Transport Fees", subHead: "-" };
  } else {
    // academic fees
    return { feeHead: "Academic Fees", subHead: map[type] || type };
  }
};

const getTrackingInfo = (trackingRecord, academicYear, semesterNumber, feeType) => {
  const defaultRes = { demand: 0, concession: 0, balance: 0 };
  if (!trackingRecord || !trackingRecord.academicYearWiseRecord) return defaultRes;

  const yr = trackingRecord.academicYearWiseRecord.find(y => y.academicYear === academicYear);
  if (!yr) return defaultRes;

  if (feeType === "transport") {
    const t = yr.transport || {};
    const subTotal = t.subTotal || 0;
    const concession = (trackingRecord.concessions?.transport || 0);
    const paid = t.total?.paid || 0;
    return {
      demand: subTotal,
      concession,
      balance: Math.max(0, subTotal - concession - paid)
    };
  } else if (feeType === "hostel") {
    const h = yr.hostel || {};
    const subTotal = h.subTotal || 0;
    const concession = (trackingRecord.concessions?.hostel || 0) + (h.hostelSpecialConcession || 0);
    const paid = h.total?.paid || 0;
    return {
      demand: subTotal,
      concession,
      balance: Math.max(0, subTotal - concession - paid)
    };
  } else {
    // academic
    if (!semesterNumber) return defaultRes;
    const semKey = (semesterNumber % 2 !== 0) ? "odd" : "even";
    const sem = yr.academic?.[semKey];
    if (!sem) return defaultRes;

    const comp = sem[feeType] || {};
    const subTotal = comp.subTotal || 0;
    const concession = comp.concession || 0;
    const paid = comp.paid || 0;
    return {
      demand: subTotal,
      concession,
      balance: Math.max(0, subTotal - concession - paid)
    };
  }
};

exports.generateIndividualReport = async (query) => {
  const { rollNo, semester, fromDate, toDate } = query;

  /* ────────────────────────────────────────────────
     1. Fetch Student
  ──────────────────────────────────────────────── */
  const student = await Student.findOne({
    "personal.rollNo": rollNo
  }).lean();

  let studentData = null;

  if (student) {
    studentData = {
      rollNo: student.personal.rollNo,
      studentName: student.personal.studentName,
      studentPhoto: student.personal.studentPhoto || "",
      registerNumber: student.personal.registerNumber || "",
      departmentName: student.academic?.departmentName || "",
      yearStudying: student.academic?.yearStudying || "",
      section: student.academic?.section || ""
    };
  }

  /* ────────────────────────────────────────────────
     2. Fetch Fee Tracking
  ──────────────────────────────────────────────── */
  const feeTracking = await StudentFeeTracking.findOne({ rollNo }).lean();

  /* ────────────────────────────────────────────────
     3. Match Conditions
  ──────────────────────────────────────────────── */

  const matchTransactions = {};

  if (fromDate || toDate) {
    matchTransactions["transactions.paidOn"] = {};

    if (fromDate) {
      matchTransactions["transactions.paidOn"].$gte =
        new Date(`${fromDate}T00:00:00.000Z`);
    }

    if (toDate) {
      matchTransactions["transactions.paidOn"].$lte =
        new Date(`${toDate}T23:59:59.999Z`);
    }
  }

  const matchBreakdowns = {};

  if (semester) {
    if (semester === "odd") {
      matchBreakdowns["transactions.breakdowns.semesterNumber"] = {
        $in: [1, 3, 5, 7]
      };
    }

    if (semester === "even") {
      matchBreakdowns["transactions.breakdowns.semesterNumber"] = {
        $in: [2, 4, 6, 8]
      };
    }
  }

  /* ────────────────────────────────────────────────
     4. Aggregation Pipeline
  ──────────────────────────────────────────────── */

  const pipeline = [
    { $match: { rollNo } },

    { $unwind: "$transactions" }
  ];

  if (Object.keys(matchTransactions).length) {
    pipeline.push({ $match: matchTransactions });
  }

  pipeline.push(
    {
      $unwind: {
        path: "$transactions.breakdowns",
        preserveNullAndEmptyArrays: false
      }
    }
  );

  if (Object.keys(matchBreakdowns).length) {
    pipeline.push({ $match: matchBreakdowns });
  }

  pipeline.push(
    {
      $unwind: {
        path: "$transactions.breakdowns.feeHeads",
        preserveNullAndEmptyArrays: false
      }
    },
    {
      $project: {
        _id: 0,
        receiptNo: "$transactions.receiptNo",
        paymentDate: "$transactions.paidOn",
        paymentMode: "$transactions.paymentType",
        academicYear: "$transactions.breakdowns.academicYear",
        semesterNumber: "$transactions.breakdowns.semesterNumber",
        feeType: "$transactions.breakdowns.feeHeads.type",
        paidAmount: "$transactions.breakdowns.feeHeads.fee"
      }
    },
    { $sort: { paymentDate: -1 } }
  );

  const aggregatedRows = await StudentTransaction.aggregate(pipeline);

  /* ────────────────────────────────────────────────
     5. Build Final Rows
  ──────────────────────────────────────────────── */

  const rows = aggregatedRows.map((row) => {
    const trackingInfo = getTrackingInfo(
      feeTracking,
      row.academicYear,
      row.semesterNumber,
      row.feeType
    );

    const feeInfo = formatFeeHeadInfo(row.feeType);

    return {
      receiptNo: row.receiptNo,
      feeHead: feeInfo.feeHead,
      subHead: feeInfo.subHead,
      demand: normalizeMoney(trackingInfo.demand),
      concession: normalizeMoney(trackingInfo.concession),
      paid: normalizeMoney(row.paidAmount),
      balance: normalizeMoney(trackingInfo.balance),
      paymentDate: row.paymentDate,
      paymentMode: row.paymentMode
    };
  });

  return {
    student: studentData,
    rows
  };
};

exports.generateDatewiseReport = async (query) => {
  const {
    fromDate,
    toDate,
    academicYear,
    paymentMode,
    feeHead,
    page = 1,
    limit = 20
  } = query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  /* ────────────────────────────────────────────────
     1. Build Match Conditions
  ──────────────────────────────────────────────── */

  const matchTransactions = {};

  if (fromDate || toDate) {
    matchTransactions["transactions.paidOn"] = {};

    if (fromDate) {
      matchTransactions["transactions.paidOn"].$gte =
        new Date(`${fromDate}T00:00:00.000Z`);
    }

    if (toDate) {
      matchTransactions["transactions.paidOn"].$lte =
        new Date(`${toDate}T23:59:59.999Z`);
    }
  }

  if (paymentMode) {
    matchTransactions["transactions.paymentType"] = paymentMode;
  }

  const matchBreakdown = {};

  if (academicYear) {
    matchBreakdown["transactions.breakdowns.academicYear"] = academicYear;
  }

  const matchFeeHead = {};

  if (feeHead) {
    matchFeeHead["transactions.breakdowns.feeHeads.type"] = feeHead;
  }

  /* ────────────────────────────────────────────────
     2. Aggregation Pipeline
  ──────────────────────────────────────────────── */

  const pipeline = [
    { $unwind: "$transactions" }
  ];

  if (Object.keys(matchTransactions).length) {
    pipeline.push({ $match: matchTransactions });
  }

  pipeline.push({
    $unwind: {
      path: "$transactions.breakdowns",
      preserveNullAndEmptyArrays: false
    }
  });

  if (Object.keys(matchBreakdown).length) {
    pipeline.push({ $match: matchBreakdown });
  }

  pipeline.push({
    $unwind: {
      path: "$transactions.breakdowns.feeHeads",
      preserveNullAndEmptyArrays: false
    }
  });

  if (Object.keys(matchFeeHead).length) {
    pipeline.push({ $match: matchFeeHead });
  }

  pipeline.push(
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentDoc"
      }
    },
    {
      $unwind: {
        path: "$studentDoc",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        rollNo: "$rollNo",
        receiptNo: "$transactions.receiptNo",
        amount: "$transactions.breakdowns.feeHeads.fee",
        date: "$transactions.paidOn",
        paymentMode: "$transactions.paymentType",
        bank: {
          $ifNull: ["$transactions.bankName", "$transactions.paymentType"]
        },
        feeType: "$transactions.breakdowns.feeHeads.type",
        semesterNumber: "$transactions.breakdowns.semesterNumber",
        paymentAcademicYear: "$transactions.breakdowns.academicYear",
        studentName: "$studentDoc.personal.studentName",
        studentPhoto: "$studentDoc.personal.studentPhoto",
        department: "$studentDoc.academic.departmentName",
        year: "$studentDoc.academic.yearStudying",
        section: "$studentDoc.academic.section",
        currentAcademicYear: "$studentDoc.academic.currentAcademicYear"
      }
    },
    { $sort: { date: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    }
  );

  /* ────────────────────────────────────────────────
     3. Execute Aggregation
  ──────────────────────────────────────────────── */

  const result = await StudentTransaction.aggregate(pipeline);

  const fetchedData = result[0]?.data || [];
  const totalRecords = result[0]?.metadata[0]?.total || 0;

  /* ────────────────────────────────────────────────
     4. Format Rows
  ──────────────────────────────────────────────── */

  const rows = fetchedData.map((row) => {
    let semPeriod = "-";

    if (row.semesterNumber) {
      semPeriod = row.semesterNumber % 2 !== 0 ? "Odd Sem" : "Even Sem";
    }

    const feeInfo = formatFeeHeadInfo(row.feeType);

    return {
      student: {
        studentName: row.studentName || "",
        studentPhoto: row.studentPhoto || "",
        department: row.department || "",
        year: row.year || "",
        section: row.section || "",
        currentAcademicYear: row.currentAcademicYear || ""
      },
      rollNo: row.rollNo,
      semPeriod,
      paymentSemester: row.semesterNumber || "-",
      paymentAcademicYear: row.paymentAcademicYear || "-",
      feeHead: feeInfo.feeHead,
      subHead: feeInfo.subHead,
      amount: normalizeMoney(row.amount),
      date: row.date,
      paymentMode: row.paymentMode,
      bank: row.bank,
      receiptNo: row.receiptNo
    };
  });

  /* ────────────────────────────────────────────────
     5. Return Response
  ──────────────────────────────────────────────── */

  return {
    rows,
    pagination: {
      total: totalRecords,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRecords / limitNum)
    }
  };
};