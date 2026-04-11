const express = require("express");
const router = express.Router();
const controller = require("./controllerAcknoledgement");
const {
	validateAcknowledgment,
	validateUpdateAcknowledgment,
	validateCreateAcknowledgmentV2,
	validateUpdateAcknowledgmentV2,
	validateAckIdParamV2,
	validateGetAcknowledgment,
} = require("./validationacknoledgement");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/", validateAcknowledgment, controller.createAcknowledgment);
router.put("/", validateUpdateAcknowledgment, controller.updateAcknowledgment);
router.get("/", validateGetAcknowledgment, controller.getAcknowledgments);
router.get("/:id", validateGetAcknowledgment, controller.getAcknowledgmentById);


router.post("/v2", validateCreateAcknowledgmentV2, controller.createAcknowledgmentV2);
router.get("/v2", controller.getAcknowledgmentV2);
router.get("/v2/:id", validateAckIdParamV2, controller.getAcknowledgmentV2ByAckId);
router.put("/v2", validateUpdateAcknowledgmentV2, controller.updateAcknowledgmentV2);


module.exports = router;
