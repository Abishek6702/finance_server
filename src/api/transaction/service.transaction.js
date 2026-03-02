const StudentTransaction = require("./model.studentTransaction");
const AppError = require("../../utils/AppError");

const getStudentTransactions = async (rollNo) => {
  const transactionDoc = await StudentTransaction.findOne({ rollNo }).populate("student");
  if (!transactionDoc) throw new AppError("Transactions not found for this student", 404);
  return transactionDoc;
};

const getRecentPayments = async (query = {}) => {
  const matchFilters = {};

  if (query.year) {
    matchFilters["transactions.breakdowns.academicYear"] = query.year;
  }
  if (query.department) {
    matchFilters["studentData.academic.departmentName"] = { $regex: new RegExp(`^${query.department}$`, "i") };
  }
  if (query.paymentMode) {
    matchFilters["transactions.paymentType"] = { $regex: new RegExp(`^${query.paymentMode}$`, "i") };
  }
  if (query.name) {
    matchFilters["studentData.personal.studentName"] = { $regex: new RegExp(query.name, "i") };
  }
  if (query.rollNo) {
    matchFilters["rollNo"] = { $regex: new RegExp(`^${query.rollNo}$`, "i") };
  }
  if (query.feeHead) {
    const head = query.feeHead.toLowerCase();
    const feeHeadFilter = [];
    if (["tuition", "exam", "erp", "book", "lab"].includes(head)) {
      feeHeadFilter.push({ [`transactions.breakdowns.academic.${head}`]: { $gt: 0 } });
    }
    if (head === "hostel") feeHeadFilter.push({ "transactions.breakdowns.hostel": { $gt: 0 } });
    if (head === "transport") feeHeadFilter.push({ "transactions.breakdowns.transport": { $gt: 0 } });
    if (feeHeadFilter.length > 0) matchFilters["$or"] = feeHeadFilter;
  }
  if (query.fromDate && query.toDate) {
    matchFilters["transactions.paidOn"] = {
      $gte: new Date(query.fromDate),
      $lte: new Date(query.toDate)
    };
  } else if (query.fromDate) {
    matchFilters["transactions.paidOn"] = { $gte: new Date(query.fromDate) };
  } else if (query.toDate) {
    matchFilters["transactions.paidOn"] = { $lte: new Date(query.toDate) };
  }

  // Count total matches for pagination
  const countPipeline = [
    { $unwind: "$transactions" },
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData"
      }
    },
    { $unwind: "$studentData" }
  ];
  if (Object.keys(matchFilters).length > 0) {
    countPipeline.push({ $match: matchFilters });
  }
  countPipeline.push({ $count: "total" });
  
  const countResult = await StudentTransaction.aggregate(countPipeline).exec();
  const totalCount = countResult.length > 0 ? countResult[0].total : 0;

  // Pagination parameters
  const page = query.page && query.page !== "all" ? parseInt(query.page) : 1;
  const limit = query.limit && query.limit !== "all" ? parseInt(query.limit) : totalCount > 0 ? totalCount : 50;
  const skip = (page - 1) * limit;

  const pipeline = [
    { $unwind: "$transactions" },
    { $sort: { "transactions.paidOn": -1 } },
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData"
      }
    },
    { $unwind: "$studentData" }
  ];

  if (Object.keys(matchFilters).length > 0) {
    pipeline.push({ $match: matchFilters });
  }

  // Skip and limit for pagination, if not fetching 'all'
  if (query.limit !== "all" && query.page !== "all") {
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
  } else if (query.limit !== "all") {
    pipeline.push({ $limit: limit });
  }

  pipeline.push({
    $project: {
      rollNo: 1,
      transaction: "$transactions",
      studentDetails: {
        name: "$studentData.personal.studentName",
        department: "$studentData.academic.departmentName",
        year: "$studentData.academic.yearStudying",
        photo: "$studentData.personal.studentPhoto"
      }
    }
  });

  const records = await StudentTransaction.aggregate(pipeline).exec();

  return {
    records,
    pagination: {
      totalCount,
      page: query.page === "all" ? 1 : page,
      limit: query.limit === "all" ? totalCount : limit,
      totalPages: query.limit === "all" ? 1 : Math.ceil(totalCount / limit),
      hasMore: query.limit === "all" ? false : skip + records.length < totalCount
    }
  };
};

module.exports = {
  getStudentTransactions,
  getRecentPayments
};
