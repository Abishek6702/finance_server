const feePaymentService = require("./service");

const recordPayment = async (req, res) => {
  try {
    const transaction = await feePaymentService.recordPayment(req.body);
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStudentTransactions = async (req, res) => {
  try {
    const transactions = await feePaymentService.getStudentTransactions(req.params.rollNo);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getRecentPayments = async (req, res) => {
  try {
    const transactions = await feePaymentService.getRecentPayments(req.query);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getFeesSummary = async (req, res) => {
  try {
    const summary = await feePaymentService.getFeesSummary(req.query);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStudentFeeSummary = async (req, res) => {
  try {
    const summary = await feePaymentService.getStudentFeeSummary(req.params.rollNo);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const getStudentsForFilter = async (req, res) => {
  try {
    const students = await feePaymentService.getStudentsForFilter(req.query);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateReceipt = async (req, res) => {
  try {
    const updated = await feePaymentService.updateReceipt(req.params.receiptNo, req.body, req.user);
    res.status(200).json({ success: true, data: updated, message: "Receipt updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateConcession = async (req, res) => {
  try {
    const updated = await feePaymentService.updateConcession(req.params.rollNo, req.params.academicYear, req.body.concessions);
    res.status(200).json({ success: true, data: updated, message: "Concessions updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  recordPayment,
  getStudentTransactions,
  getRecentPayments,
  getFeesSummary,
  getStudentFeeSummary,
  getStudentsForFilter,
  updateReceipt,
  updateConcession
};
