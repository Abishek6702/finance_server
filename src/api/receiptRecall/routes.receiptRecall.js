const express = require("express");
const router = express.Router();
const controller = require("./controller.receiptRecall");
const { validateCreateRecall, validateRecallAction, validateRejectAction, validateGetRecalls } = require("./validation.receiptRecall");
const { protect, admin, superadmin } = require("../../middleware/authMiddleware");

// Admin endpoints: create recall request, list recall requests
router.post("/", protect, admin, validateCreateRecall, controller.createRecallRequest);
router.get("/", protect, admin, validateGetRecalls, controller.getRecallRequests);

// Superadmin-only endpoints: approve or reject recall
router.post("/:recallId/approve", protect, superadmin, validateRecallAction, controller.approveRecall);
router.post("/:recallId/reject", protect, superadmin, validateRejectAction, controller.rejectRecall);

module.exports = router;
