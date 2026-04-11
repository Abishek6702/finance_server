const express = require("express");
const router = express.Router();
const controller = require("./controller.refund");
const { validateCreateRefund, validateGetQuery } = require("./validation.refund");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.post("/:rollNo", protect, admin, validateCreateRefund, controller.createRefund);
router.get("/", protect, admin, validateGetQuery, controller.getRefundFlatReport);

module.exports = router;
