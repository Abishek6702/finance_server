const express = require("express");
const router = express.Router();
const controller = require("./controllerStudentFacility");
const {
  validateFacilityChange,
  validateFacilityRemoval,
  validateCancelAndAssign,
} = require("./validationStudentFacility");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.put("/assign/:rollNo", protect, admin, validateFacilityChange, controller.assignFacility);
router.put("/cancel/:rollNo", protect, admin, validateFacilityRemoval, controller.cancelFacility);
router.put(
  "/cancel-assign/:rollNo",
  protect,
  admin,
  validateCancelAndAssign,
  controller.cancelAndAssign
);
router.get("/transfer/:transferId", protect, admin, controller.getFacilityTransferById);

module.exports = router;
