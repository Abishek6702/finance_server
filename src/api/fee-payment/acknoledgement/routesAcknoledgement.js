const express = require("express");
const router = express.Router();
const controller = require("./controlleracknoledgement");
const {
	validateAcknowledgment,
	validateUpdateAcknowledgment,
	validateCreateAcknowledgmentV2,
	validateUpdateAcknowledgmentV2,
	validateAckIdParamV2,
} = require("./validationacknoledgement");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.use(protect, admin);

router.post("/ack", validateAcknowledgment, controller.createAcknowledgment);
router.put("/ack", validateUpdateAcknowledgment, controller.updateAcknowledgment);
router.post("/ack/v2", validateCreateAcknowledgmentV2, controller.createAcknowledgmentV2);
router.get("/ack/v2/:ackId", validateAckIdParamV2, controller.getAcknowledgmentV2ByAckId);
router.put("/ack/v2", validateUpdateAcknowledgmentV2, controller.updateAcknowledgmentV2);

module.exports = router;
