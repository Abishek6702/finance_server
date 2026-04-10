const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFeeTracking");
const {
	validateGetQuery,
	validateBackfillRequest,
	validateTriggerFeeUpdate,
	validatePromotionRequest,
	validateDepromotionRequest,
} = require("./validationStudentFeeTracking");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");

router.post("/backfill", protect, superadmin, validateBackfillRequest, controller.backfillAllStudentFeeTracking);
router.post("/trigger-fee-update", protect, superadmin, validateTriggerFeeUpdate, controller.triggerFeeTrackingUpdate);
router.post("/promotion", protect, superadmin, validatePromotionRequest, controller.triggerPromotionForAcademicYear);
router.post("/depromotion", protect, superadmin, validateDepromotionRequest, controller.triggerDepromotionForAcademicYear);

router.use(protect, admin);

router.get("/", validateGetQuery, controller.getStudentsFeeTrackingData);
router.get("/v2", validateGetQuery, controller.getStudentsFeeTrackingData2);



module.exports = router;

