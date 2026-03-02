const express = require("express");
const router = express.Router();
const controller = require("./controller.studentFeeTracking");
const { validateUpdateReceipt, validateUpdateConcession, validatePayment } = require("./validation.studentFeeTracking");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/receipt", validatePayment, controller.createReceipt);
router.get("/summary", controller.getFeesSummary);
router.get("/summary/:rollNo", controller.getStudentFeeSummary);
router.get("/students", controller.getStudentsForFilter);
router.put("/receipt/:receiptNo", validateUpdateReceipt, controller.updateReceipt);
router.put("/concession/:rollNo/:academicYear", validateUpdateConcession, controller.updateConcession);

module.exports = router;
