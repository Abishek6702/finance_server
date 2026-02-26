const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { validateFeeStructure } = require("./validation");
const { protect, superadmin } = require("../../middleware/authMiddleware");

router.use(protect, superadmin);

router.post("/", validateFeeStructure, controller.createFeeStructure);
router.get("/", controller.getFeeStructures);
router.get("/:academicYear", controller.getFeeStructureByYear);
router.put("/:academicYear", validateFeeStructure, controller.updateFeeStructure);
 
router.delete("/:academicYear", controller.deleteFeeStructure);

module.exports = router;
