const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFacility");
const { validateFacilityChange, validateFacilityRemoval } = require("./validationStudentFacility");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.put("/assign/:rollNo", protect, admin, validateFacilityChange, controller.assignFacility);
router.put("/cancel/:rollNo", protect, admin, validateFacilityRemoval, controller.cancelFacility);

module.exports = router;
