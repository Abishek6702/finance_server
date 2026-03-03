const express = require("express");
const router = express.Router();
const controller = require("./controller.studentFeeTracking");
const { validateGetQuery } = require("./validation.studentFeeTracking");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.get("/", validateGetQuery, controller.getStudentsFeeTrackingData);

module.exports = router;

