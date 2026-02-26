const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { validatePayment, validateUpdateReceipt, validateUpdateConcession } = require("./validation");
const { protect, admin } = require("../../middleware/authMiddleware");

// Both admin & superadmin can access this (handled by admin middleware)
router.use(protect, admin);

router.post("/pay", validatePayment, controller.recordPayment);
router.get("/recent", controller.getRecentPayments);
router.get("/summary", controller.getFeesSummary);
router.get("/summary/:rollNo", controller.getStudentFeeSummary);
router.get("/students", controller.getStudentsForFilter);

router.put("/receipt/:receiptNo", validateUpdateReceipt, controller.updateReceipt);
router.put("/concession/:rollNo/:academicYear", validateUpdateConcession, controller.updateConcession);

// This must be last because it uses a generic parameter
router.get("/:rollNo", controller.getStudentTransactions);

module.exports = router;
