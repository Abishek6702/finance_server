const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFacility");
const { validateFacilityChange } = require("./validationStudentFacility");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.put("/:rollNo", protect, admin, validateFacilityChange, controller.updateFacility);

module.exports = router;
