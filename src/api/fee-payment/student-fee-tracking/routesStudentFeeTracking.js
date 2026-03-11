const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFeeTracking");
const { validateGetQuery } = require("./validationStudentFeeTracking");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.use(protect, admin);

router.get("/", validateGetQuery, controller.getStudentsFeeTrackingData);

module.exports = router;

