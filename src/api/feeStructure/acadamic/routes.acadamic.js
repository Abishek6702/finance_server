const express = require("express");
const router = express.Router();
const controller = require("./controller.acadamic");
const { validateFeeStructure } = require("./validation.acadamic");
const { protect, superadmin } = require("../../../middleware/authMiddleware");

router.use(protect, superadmin);

router.post("/", validateFeeStructure, controller.createFeeStructure);
router.get("/", controller.getFeeStructures);

// Bulk route must be declared BEFORE /:academicYear to avoid param conflict
router.post("/bulk", controller.bulkUpsertFeeStructure);

router.get("/:academicYear", controller.getFeeStructureByYear);
router.put("/:academicYear", validateFeeStructure, controller.updateFeeStructure);
router.delete("/:academicYear", controller.deleteFeeStructure);

module.exports = router;
