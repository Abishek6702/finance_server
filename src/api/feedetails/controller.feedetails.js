const asyncHandler = require("../../utils/asyncHandler");
const service = require("./service.feedetails");

const getFeeDetailsList = asyncHandler(async (req, res) => {
  const { data, totalRecords } = await service.getFeeDetailsList(req.query);
  res.status(200).json({
    success: true,
    data,
    pagination: { totalRecords },
    message: "Fee details fetched successfully",
  });
});

const getFeeDetailsByRollNo = asyncHandler(async (req, res) => {
  const data = await service.getFeeDetailsByRollNo(req.params.rollNo, req.query);
  res.status(200).json({
    success: true,
    data,
    message: "Student fee year-wise summary fetched successfully",
  });
});

const getFeeDetailsBySemester = asyncHandler(async (req, res) => {
  const { rollNo, academicYear } = req.params;
  const data = await service.getFeeDetailsBySemester(rollNo, academicYear, req.query);
  res.status(200).json({
    success: true,
    data,
    message: "Semester fee breakdown fetched successfully",
  });
});

module.exports = { getFeeDetailsList, getFeeDetailsByRollNo, getFeeDetailsBySemester };
