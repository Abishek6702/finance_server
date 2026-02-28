const transactionService = require("./service.transaction");
const asyncHandler = require("../../utils/asyncHandler");

const recordPayment = asyncHandler(async (req, res) => {
  const data = await transactionService.recordPayment(req.body);
  res.status(201).json({ success: true, data, message: "Payment recorded successfully" });
});

const getStudentTransactions = asyncHandler(async (req, res) => {
  const data = await transactionService.getStudentTransactions(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Transactions fetched successfully" });
});

const getRecentPayments = asyncHandler(async (req, res) => {
  const data = await transactionService.getRecentPayments(req.query);
  res.status(200).json({ success: true, data, message: "Recent payments fetched successfully" });
});

const getStudentReport = asyncHandler(async (req, res) => {
  const data = await transactionService.getStudentReport(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Student report fetched successfully" });
});

const getDatewiseReport = asyncHandler(async (req, res) => {
  const data = await transactionService.getDatewiseReport(req.query);
  res.status(200).json({ success: true, data, message: "Date-wise report fetched successfully" });
});

module.exports = {
  recordPayment,
  getStudentTransactions,
  getRecentPayments,
  getStudentReport,
  getDatewiseReport
};
