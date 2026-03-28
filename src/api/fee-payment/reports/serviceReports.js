const mongoose = require("mongoose");
const StudentTransaction = require("../payments/model/modelStudentFeePayments");
const StudentFeeTracking = require("../student-fee-tracking/modelStudentFeeTracking");
const Student = require("../../student/students-management/modelStudent");

const normalizeMoney = (val) => Math.round((Number(val) || 0) * 100) / 100;
const normalizeReductionReasonId = (value) => (value ? String(value) : null);
const ACADEMIC_FEE_TYPES = ["tuition", "exam", "erp", "book", "lab"];

const formatDdMmYyyy = (date = new Date()) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
};

const getAcademicYearStart = (year) => {
  const start = parseInt(String(year || "").split("-")[0], 10);
  return Number.isNaN(start) ? Number.MAX_SAFE_INTEGER : start;
};

const getPendingFromAmountNode = (amountNode) => {
  const total = normalizeMoney(amountNode?.total || 0);
  const paid = normalizeMoney(amountNode?.paid || 0);
  return normalizeMoney(Math.max(0, total - paid));
};

const getPendingFromAcademicComponent = (componentNode) => {
  const total = normalizeMoney(componentNode?.total || 0);
  const paid = normalizeMoney(componentNode?.paid || 0);
  return normalizeMoney(Math.max(0, total - paid));
};

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
  const { rollNo, semester, fromDate, toDate , academicYear } = query;

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
    matchTransactions["transactions.billingDate"] = {};

    if (fromDate) {
      matchTransactions["transactions.billingDate"].$gte =
        new Date(`${fromDate}T00:00:00.000Z`);
    }

    if (toDate) {
      matchTransactions["transactions.billingDate"].$lte =
        new Date(`${toDate}T23:59:59.999Z`);
    }
  }

  const matchBreakdowns = {};
 
  if (academicYear) {
    matchBreakdowns["transactions.breakdowns.academicYear"] = academicYear;
  }

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
    { $sort: { "transactions.createdAt": -1 } },
    {
      $project: {
        _id: 0,
        receiptNo: "$transactions.receiptNo",
        reductionReasonId: "$transactions.reductionId",
        paymentDate: "$transactions.billingDate",
        paymentMode: "$transactions.paymentType",
        academicYear: "$transactions.breakdowns.academicYear",
        semesterNumber: "$transactions.breakdowns.semesterNumber",
        feeType: "$transactions.breakdowns.feeHeads.type",
        paidAmount: "$transactions.breakdowns.feeHeads.fee"
      }
    }
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
      reductionReasonId: normalizeReductionReasonId(row.reductionReasonId),
      feeHead: feeInfo.feeHead,
      subHead: feeInfo.subHead,
      paidForAcademicYear: row.academicYear,
      paidForSemester: row.semesterNumber || "-",
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
    matchTransactions["transactions.billingDate"] = {};

    if (fromDate) {
      matchTransactions["transactions.billingDate"].$gte =
        new Date(`${fromDate}T00:00:00.000Z`);
    }

    if (toDate) {
      matchTransactions["transactions.billingDate"].$lte =
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
    {
      $unwind: "$transactions"
    }
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
    /* SORT BY CREATED DATE */
    {
      $sort: { "transactions.createdAt": -1 }
    },
    {
      $project: {
        _id: 0,
        rollNo: "$rollNo",
        receiptNo: "$transactions.receiptNo",
        reductionReasonId: "$transactions.reductionId",
        amount: "$transactions.breakdowns.feeHeads.fee",
        date: "$transactions.billingDate",
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
      receiptNo: row.receiptNo,
      reductionReasonId: normalizeReductionReasonId(row.reductionReasonId)
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

exports.generateClasswiseReport = async (query) => {
  const {
    academicYear,
    department,
    yearOfStudying,
    studeingyear,
    section,
    status,
    page = 1,
    limit = 20
  } = query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const emptyOverall = {
    oddSemTotal: 0,
    evenSemTotal: 0,
    yearTotal: 0,
    paidAmount: 0,
    pendingTotal: 0
  };

  /* ────────────────────────────────────────────────
     1. Build Match Conditions for Students
  ──────────────────────────────────────────────── */
  const studentQuery = {};
  if (department) studentQuery["academic.departmentName"] = department;
  const targetYearOfStudying = yearOfStudying || studeingyear;
  if (targetYearOfStudying) {
    studentQuery["academic.yearStudying"] = parseInt(targetYearOfStudying, 10);
  }
  if (section) studentQuery["academic.section"] = section;

  const students = await Student.find(studentQuery).lean();
  if (!students.length) {
    return {
      rows: [],
      overall: emptyOverall,
      pagination: {
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0
      }
    };
  }

  const rollNos = students.map((s) => s.personal.rollNo);

  /* ────────────────────────────────────────────────
     2. Fetch Fee Trackings
  ──────────────────────────────────────────────── */
  const trackings = await StudentFeeTracking.find({ rollNo: { $in: rollNos } }).lean();
  const trackingByRollNo = trackings.reduce((acc, t) => {
    acc[t.rollNo] = t;
    return acc;
  }, {});

  const statusFilter = status ? status.toLowerCase() : null;
  const ACADEMIC_FIELDS = ["tuition", "exam", "erp", "book", "lab"];
  const rows = [];
  const overall = { ...emptyOverall };

  /* ────────────────────────────────────────────────
     3. Extract Rows
  ──────────────────────────────────────────────── */
  for (const student of students) {
    const rollNo = student.personal?.rollNo;
    if (!rollNo) continue;

    const tracking = trackingByRollNo[rollNo];
    const targetAcademicYear = academicYear || student.academic?.currentAcademicYear;

    const yearRecord = tracking?.academicYearWiseRecord?.find(
      (yr) => yr.academicYear === targetAcademicYear
    );

    if (!yearRecord) continue;

    const oddSemTotal = normalizeMoney(yearRecord?.academic?.odd?.total?.total || 0);
    const evenSemTotal = normalizeMoney(yearRecord?.academic?.even?.total?.total || 0);
    const yearTotal = normalizeMoney(oddSemTotal + evenSemTotal);
    const paidAmount = normalizeMoney(yearRecord?.academic?.total?.paid || 0);
    const pending = normalizeMoney(Math.max(0, yearTotal - paidAmount));

    let derivedStatus = "unpaid";
    if (pending <= 0) derivedStatus = "paid";
    else if (paidAmount > 0) derivedStatus = "partial";

    overall.oddSemTotal = normalizeMoney(overall.oddSemTotal + oddSemTotal);
    overall.evenSemTotal = normalizeMoney(overall.evenSemTotal + evenSemTotal);
    overall.yearTotal = normalizeMoney(overall.yearTotal + yearTotal);
    overall.paidAmount = normalizeMoney(overall.paidAmount + paidAmount);
    overall.pendingTotal = normalizeMoney(overall.pendingTotal + pending);

    const baseRow = {
      studentName: student.personal?.studentName || "",
      rollNo,
      section: student.academic?.section || "",
      department: student.academic?.departmentName || "",
      year: student.academic?.yearStudying || "",
      academicYear: targetAcademicYear || "",
    };

    if (yearRecord.academic) {
      ["odd", "even"].forEach((semKey) => {
        const sem = yearRecord.academic[semKey];
        if (!sem) return;

        const semNumber = sem.semesterNumber || "-";

        ACADEMIC_FIELDS.forEach((fType) => {
          const comp = sem[fType];
          if (!comp) return;

          if (comp.subTotal > 0 || comp.total > 0 || comp.paid > 0) {
            const compStatus = (comp.status || "Unpaid").toLowerCase();
            if (statusFilter && compStatus !== statusFilter) return;

            const feeInfo = formatFeeHeadInfo(fType);
            rows.push({
              ...baseRow,
              semNo: semNumber,
              feeHead: feeInfo.feeHead,
              subHead: feeInfo.subHead,
              status: compStatus,
              total: normalizeMoney(comp.total),
              paid: normalizeMoney(comp.paid),
              concession: normalizeMoney(comp.concession),
              unpaid: normalizeMoney(comp.total - comp.paid)
            });
          }
        });
      });
    }

    if (yearRecord.hostel && (yearRecord.hostel.subTotal > 0 || yearRecord.hostel.total?.total > 0)) {
      const h = yearRecord.hostel;
      const total = normalizeMoney(h.total?.total || 0);
      const paid = normalizeMoney(h.total?.paid || 0);
      const hStatus = (h.total?.status || "Unpaid").toLowerCase();

      if (!statusFilter || hStatus === statusFilter) {
        const feeInfo = formatFeeHeadInfo("hostel");
        rows.push({
          ...baseRow,
          semNo: "-",
          feeHead: feeInfo.feeHead,
          subHead: feeInfo.subHead,
          status: hStatus, 
          total,
          paid,
          concession: normalizeMoney((yearRecord.concessions?.hostel || 0) + (h.hostelSpecialConcession || 0)),
          unpaid: normalizeMoney(total - paid)
        });
      }
    }

    if (yearRecord.transport && (yearRecord.transport.subTotal > 0 || yearRecord.transport.total?.total > 0)) {
      const t = yearRecord.transport;
      const total = normalizeMoney(t.total?.total || 0);
      const paid = normalizeMoney(t.total?.paid || 0);
      const tStatus = (t.total?.status || "Unpaid").toLowerCase();

      if (!statusFilter || tStatus === statusFilter) {
        const feeInfo = formatFeeHeadInfo("transport");
        rows.push({
          ...baseRow,
          semNo: "-",
          feeHead: feeInfo.feeHead,
          subHead: feeInfo.subHead,
          status: tStatus,
          total,
          paid,
          concession: normalizeMoney(yearRecord.concessions?.transport || 0),
          unpaid: normalizeMoney(total - paid)
        });
      }
    }
  }

  const totalRows = rows.length;
  const paginatedRows = rows.slice(skip, skip + limitNum);

  return {
    rows: paginatedRows,
    overall,
    pagination: {
      total: totalRows,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalRows / limitNum)
    }
  };
};

exports.generateCumulativeBalanceHistoryReport = async (query) => {
  const {
    academicYear,
    department,
    section,
    yearOfStudying,
    studeingyear,
    status,
    page = 1,
    limit = 20
  } = query;

  const targetYearOfStudying = parseInt(yearOfStudying || studeingyear, 10);
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const studentQuery = {
    "academic.currentAcademicYear": academicYear,
    "academic.yearStudying": targetYearOfStudying
  };

  if (department) studentQuery["academic.departmentName"] = department;
  if (section) studentQuery["academic.section"] = section;

  const students = await Student.find(studentQuery).lean();
  if (!students.length) {
    return {
      academicYear,
      department: department || "",
      section: section || "",
      generatedOn: formatDdMmYyyy(),
      students: [],
      grandTotal: { oddSem: 0, evenSem: 0, total: 0 },
      pagination: {
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0
      }
    };
  }

  const rollNos = students.map((s) => s.personal?.rollNo).filter(Boolean);
  const trackings = await StudentFeeTracking.find({ rollNo: { $in: rollNos } }).lean();
  const trackingByRollNo = trackings.reduce((acc, item) => {
    acc[item.rollNo] = item;
    return acc;
  }, {});

  const statusFilter = status ? status.toLowerCase() : null;

  const reportStudents = [];
  let grandOddSem = 0;
  let grandEvenSem = 0;

  for (const student of students) {
    const rollNo = student.personal?.rollNo;
    if (!rollNo) continue;

    const tracking = trackingByRollNo[rollNo];
    if (!tracking?.academicYearWiseRecord?.length) continue;

    const sortedYearRecords = [...tracking.academicYearWiseRecord].sort(
      (a, b) => getAcademicYearStart(a.academicYear) - getAcademicYearStart(b.academicYear)
    );

    const currentYearRecord = sortedYearRecords.find((yr) => yr.academicYear === academicYear);
    if (!currentYearRecord) continue;

    const currentYearIndex = sortedYearRecords.findIndex((yr) => yr.academicYear === academicYear);

    const balances = {};
    for (let yr = 1; yr < targetYearOfStudying; yr += 1) {
      const historyIndex = currentYearIndex - (targetYearOfStudying - yr);
      const historyRecord = historyIndex >= 0 ? sortedYearRecords[historyIndex] : null;
      balances[`year${yr}`] = historyRecord
        ? getPendingFromAmountNode(historyRecord.total)
        : 0;
    }

    const oddSem = currentYearRecord.academic?.odd || {};
    const evenSem = currentYearRecord.academic?.even || {};
    const yearFeeKey = `year${targetYearOfStudying}Fees`;

    const yearFees = ACADEMIC_FEE_TYPES.map((feeType) => {
      const oddPending = getPendingFromAcademicComponent(oddSem[feeType]);
      const evenPending = getPendingFromAcademicComponent(evenSem[feeType]);
      const totalPending = normalizeMoney(oddPending + evenPending);

      return {
        feeHead: feeType,
        oddSem: oddPending,
        evenSem: evenPending,
        total: totalPending
      };
    }).filter((item) => item.total > 0);

    const transportPending = getPendingFromAmountNode(currentYearRecord.transport?.total);
    if (transportPending > 0) {
      yearFees.push({
        feeHead: "transport",
        oddSem: transportPending,
        evenSem: 0,
        total: transportPending
      });
    }

    const hostelPending = getPendingFromAmountNode(currentYearRecord.hostel?.total);
    if (hostelPending > 0) {
      yearFees.push({
        feeHead: "hostel",
        oddSem: hostelPending,
        evenSem: 0,
        total: hostelPending
      });
    }

    const totalOddSem = normalizeMoney(yearFees.reduce((sum, item) => sum + item.oddSem, 0));
    const totalEvenSem = normalizeMoney(yearFees.reduce((sum, item) => sum + item.evenSem, 0));
    const totalGrand = normalizeMoney(totalOddSem + totalEvenSem);

    const yearPaid = normalizeMoney(currentYearRecord.total?.paid || 0);
    const yearPending = getPendingFromAmountNode(currentYearRecord.total);
    let derivedStatus = "unpaid";
    if (yearPending <= 0) derivedStatus = "paid";
    else if (yearPaid > 0) derivedStatus = "partial";

    if (statusFilter && derivedStatus !== statusFilter) continue;

    grandOddSem = normalizeMoney(grandOddSem + totalOddSem);
    grandEvenSem = normalizeMoney(grandEvenSem + totalEvenSem);

    reportStudents.push({
      rollNo,
      studentName: student.personal?.studentName || "",
      balances,
      [yearFeeKey]: yearFees,
      total: {
        oddSem: totalOddSem,
        evenSem: totalEvenSem,
        grandTotal: totalGrand
      }
    });
  }

  const totalStudents = reportStudents.length;
  const pageStudents = reportStudents.slice(skip, skip + limitNum).map((item, index) => ({
    slNo: skip + index + 1,
    ...item
  }));

  const resolvedDepartment = department || (students[0]?.academic?.departmentName || "");
  const resolvedSection = section || (students[0]?.academic?.section || "");

  return {
    academicYear,
    department: resolvedDepartment,
    section: resolvedSection,
    generatedOn: formatDdMmYyyy(),
    students: pageStudents,
    grandTotal: {
      oddSem: grandOddSem,
      evenSem: grandEvenSem,
      total: normalizeMoney(grandOddSem + grandEvenSem)
    },
    pagination: {
      total: totalStudents,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalStudents / limitNum)
    }
  };
};