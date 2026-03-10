const express = require("express");
const router = express.Router();
const controller = require("./controller.feePayments");
const { validatePayment, validateAllTransactionsQuery, validateStudentTransactionsQuery, validateRecentTransactionsQuery } = require("./validation.feePayments");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/pay", validatePayment, controller.createPayment);
router.get("/recent", validateRecentTransactionsQuery, controller.getRecentTransactions);
router.get("/", validateAllTransactionsQuery, controller.getAllTransactions);
router.get("/:rollNo", validateStudentTransactionsQuery, controller.getStudentTransactions);

module.exports = router;
