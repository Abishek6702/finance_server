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

const getReceiptByReceiptNo = asyncHandler(async (req, res) => {
  const data = await transactionService.getReceiptByReceiptNo(req.params.receiptNo);
  res.status(200).json({ success: true, data, message: "Receipt fetched successfully" });
});

module.exports = {
  createPayment,
  getAllTransactions,
  getStudentTransactions,
  getReceiptByReceiptNo,
};
