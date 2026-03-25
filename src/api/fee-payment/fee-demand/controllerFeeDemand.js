 const asyncHandler = require("../../../utils/asyncHandler");
 const service = require("./serviceFeeDemand");
 
 const getFeeDemandList = asyncHandler(async (req, res) => {
   const { data, totalRecords } = await service.getFeeDemandList(req.query);
   res.status(200).json({
     success: true,
     data,
     pagination: { totalRecords },
     message: "Fee details fetched successfully",
   });
 });
 
 const getFeeDemandByRollNo = asyncHandler(async (req, res) => {
   const data = await service.getFeeDemandByRollNo(req.params.rollNo, req.query);
   res.status(200).json({
     success: true,
     data,
     message: "Student fee year-wise summary fetched successfully",
   });
 });
 
 const getFeeDemandBySemester = asyncHandler(async (req, res) => {
   const { rollNo, academicYear } = req.params;
   const data = await service.getFeeDemandBySemester(rollNo, academicYear, req.query);
   res.status(200).json({
     success: true,
     data,
     message: "Semester fee breakdown fetched successfully",
   });
 });
 
 module.exports = { getFeeDemandList, getFeeDemandByRollNo, getFeeDemandBySemester };
 