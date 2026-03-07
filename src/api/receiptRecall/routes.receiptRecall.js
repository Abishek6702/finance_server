const express = require("express");
const router = express.Router();
const controller = require("./controller.receiptRecall");
const { validateCreateRecall, validateGetRecalls } = require("./validation.receiptRecall");
const { protect, admin } = require("../../middleware/authMiddleware");

// Admin creates recall (instant rollback — no approval needed)
router.post("/", protect, admin, validateCreateRecall, controller.createRecall);

// Admin (and superadmin via admin guard) lists recall history
router.get("/", protect, admin, validateGetRecalls, controller.getRecalls);

module.exports = router;
