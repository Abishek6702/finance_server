const transactionService = require("./service.transaction");
const asyncHandler = require("../../utils/asyncHandler");

const createPayment = asyncHandler(async (req, res) => {
  const data = await transactionService.createPayment(req.body);
  res.status(201).json({ success: true, data, message: "Payment recorded successfully" });
});

const getAllTransactions = asyncHandler(async (req, res) => {
  const data = await transactionService.getAllTransactions(req.query);
  res.status(200).json({ success: true, data, message: "Transactions fetched successfully" });
});

const getStudentTransactions = asyncHandler(async (req, res) => {
  const data = await transactionService.getStudentTransactions(req.params.rollNo, req.query);
  res.status(200).json({ success: true, data, message: "Student transactions fetched successfully" });
});

const getNextReceiptNo = asyncHandler(async (req, res) => {
  const data = await transactionService.getNextReceiptNo();
  res.status(200).json({ success: true, data, message: "Next receipt number generated" });
});

module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
  getNextReceiptNo,
};
