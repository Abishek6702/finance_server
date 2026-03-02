const transactionService = require("./service.transaction");
const asyncHandler = require("../../utils/asyncHandler");

const getStudentTransactions = asyncHandler(async (req, res) => {
  const data = await transactionService.getStudentTransactions(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Transactions fetched successfully" });
});

const getRecentPayments = asyncHandler(async (req, res) => {
  const data = await transactionService.getRecentPayments(req.query);
  res.status(200).json({ success: true, data, message: "Recent payments fetched successfully" });
});

module.exports = {
  getStudentTransactions,
  getRecentPayments
};
