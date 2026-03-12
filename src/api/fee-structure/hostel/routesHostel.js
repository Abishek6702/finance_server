const express = require('express');
const router = express.Router();
const controller = require("./controllerHostel");
const validation = require("./validationHostel");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");

router.get("/", protect, admin, controller.getAllHostels);

router.post("/", protect, superadmin, validation.validateCreate, controller.createHostel);

router.post("/bulk", protect, superadmin, validation.validateBulkCreate, controller.bulkCreateHostels);

router.put("/:id/fee", protect, superadmin, validation.validateIdParam, validation.validateUpdateFee, controller.updateHostelFee);

router.put("/:id", protect, superadmin, validation.validateIdParam, validation.validateCreate, controller.updateHostelConfig);

router.delete("/:id", protect, superadmin, validation.validateIdParam, controller.deleteHostel);
 
module.exports = router;
