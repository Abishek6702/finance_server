const express = require("express");
const router = express.Router();
const controller = require("./controller.transaction");
const { validatePayment } = require("./validation.transaction");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/pay", validatePayment, controller.recordPayment);
router.get("/recent", controller.getRecentPayments);
router.get("/:rollNo", controller.getStudentTransactions);

module.exports = router;
