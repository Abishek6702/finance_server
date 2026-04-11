 const asyncHandler = require("../../../utils/asyncHandler");
 const service = require("./serviceFeeDemand");
 
 const getFeeDemandList = asyncHandler(async (req, res) => {
  const { data, pagination } = await service.getFeeDemandList(req.query);
   res.status(200).json({
     success: true,
     data,
    pagination: {
      totalRecords: pagination.total,
    },
     message: "Fee details fetched successfully",
   });
 });
 
 const getFeeDemandByRollNo = asyncHandler(async (req, res) => {
   const data = await service.getFeeDemandByRollNo(req.params.rollNo, req.query);
   res.status(200).json({
     success: true,
     data,
    message: "Student fee demand fetched successfully",
   });
 });
  
 
 module.exports = { getFeeDemandList, getFeeDemandByRollNo };
 