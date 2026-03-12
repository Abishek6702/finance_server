const express = require("express");
const router = express.Router();
const controller = require("./controller.refund");
const { validateCreateRefund, validateGetQuery } = require("./validation.refund");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.post("/:rollNo", protect, admin, validateCreateRefund, controller.createRefund);
router.get("/student/:rollNo", protect, admin, controller.getRefundsByStudent);
router.get("/year/:academicYear", protect, admin, validateGetQuery, controller.getRefundsByYear);
router.get("/report", protect, admin, validateGetQuery, controller.getRefundReport);

module.exports = router;
