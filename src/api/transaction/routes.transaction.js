const express = require("express");
const router = express.Router();
const controller = require("./controller.transaction");
const { validatePayment, validateAllTransactionsQuery, validateStudentTransactionsQuery } = require("./validation.transaction");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/pay", validatePayment, controller.createPayment); 
router.get("/", validateAllTransactionsQuery, controller.getAllTransactions);
router.get("/:rollNo", validateStudentTransactionsQuery, controller.getStudentTransactions);

module.exports = router;
