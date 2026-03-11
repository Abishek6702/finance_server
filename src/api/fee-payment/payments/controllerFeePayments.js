const feePaymentsService = require("./serviceFeePayments");
const asyncHandler = require("../../../utils/asyncHandler");

const createPayment = asyncHandler(async (req, res) => {
  const data = await feePaymentsService.createPayment(req.body);
  res.status(201).json({ success: true, data, message: "Payment recorded successfully" });
});

const getAllTransactions = asyncHandler(async (req, res) => {
  const data = await feePaymentsService.getAllTransactions(req.query);
  res.status(200).json({ success: true, data, message: "Transactions fetched successfully" });
});

const getStudentTransactions = asyncHandler(async (req, res) => {
  const data = await feePaymentsService.getStudentTransactions(req.params.rollNo, req.query);
  res.status(200).json({ success: true, data, message: "Student transactions fetched successfully" });
});

const getRecentTransactions = asyncHandler(async (req, res) => {
  const data = await feePaymentsService.getRecentTransactions(req.query);
  res.status(200).json({ success: true, data, message: "Transactions fetched successfully" });
});

module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
  getRecentTransactions,
};
