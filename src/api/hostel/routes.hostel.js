const express = require('express');
const router = express.Router();
const controller = require("./controller.hostel");
const validation = require("./validation.hostel");

/**
 * API 1 - GET /api/hostel
 * Returns full hostel mapping grouped by block
 */
router.get('/', controller.getFullMapping);

/**
 * API 2 - POST /api/hostel/blocks
 * Returns blocks filtered by roomType (sharing, isAttached)
 */
router.post('/blocks', validation.validateGetBlocks, controller.getBlocks);

/**
 * API 3 - POST /api/hostel/roomTypes
 * Returns roomTypes for a specific block
 */
router.post('/roomTypes', validation.validateGetRoomTypes, controller.getRoomTypes);

/**
 * API 4 - POST /api/hostel/fees
 * Returns fees
 */
router.post('/fees', validation.validateGetFees, controller.getFees);

module.exports = router;
