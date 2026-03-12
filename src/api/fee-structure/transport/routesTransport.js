const express = require('express');
const router = express.Router();
const controller = require("./controllerTransport");
const validation = require("./validationTransport");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");

router.get("/", protect, admin, controller.getAllTransportStops);

router.post("/", protect, superadmin, validation.validateCreate, controller.createTransportStop);

router.post("/bulk", protect, superadmin, validation.validateBulkCreate, controller.bulkCreateTransportStops);

router.put("/:id/fee", protect, superadmin, validation.validateIdParam, validation.validateUpdateFee, controller.updateTransportFee);

router.put("/:id", protect, superadmin, validation.validateIdParam, validation.validateCreate, controller.updateTransportConfig);

router.delete("/:id", protect, superadmin, validation.validateIdParam, controller.deleteTransportStop);
 
module.exports = router;
