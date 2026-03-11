const express = require("express");
const router = express.Router();
const controller = require("./controller.StudentFacilityManagement");
const { validateFacilityChange } = require("./validation.StudentFacilityManagement");
const { protect, admin } = require("../../middleware/authMiddleware");

router.put("/:rollNo", protect, admin, validateFacilityChange, controller.updateFacility);

module.exports = router;
