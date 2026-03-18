const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFeeTracking");
const { validateGetQuery, validateBackfillRequest } = require("./validationStudentFeeTracking");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");

router.post("/backfill", protect, superadmin, validateBackfillRequest, controller.backfillAllStudentFeeTracking);

router.use(protect, admin);

router.get("/v2/", validateGetQuery, controller.getStudentsFeeTrackingData);

router.get("/", validateGetQuery, controller.getStudentsFeeTrackingData2);

module.exports = router;

