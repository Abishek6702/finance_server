const transactionService = require("./service.transaction");

const recordPayment = async (req, res) => {
  try {
    const transaction = await transactionService.recordPayment(req.body);
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStudentTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getStudentTransactions(req.params.rollNo);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getRecentPayments = async (req, res) => {
  try {
    const transactions = await transactionService.getRecentPayments(req.query);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  recordPayment,
  getStudentTransactions,
  getRecentPayments
};
