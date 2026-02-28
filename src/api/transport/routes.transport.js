const express = require('express');
const router = express.Router();
const controller = require("./controller.transport");
const validation = require("./validation.transport");
const { protect, admin } = require("../../middleware/authMiddleware");

/**
 * API 1 - GET /api/transport
 * Returns full transport mapping grouped by route & busNo
 */
router.get('/', controller.getFullMapping);

/**
 * API 2 - POST /api/transport/stops
 * Returns stops filtered by route and/or busNo
 */
router.post('/stops', validation.validateGetStops, controller.getStops);

/**
 * API 3 - POST /api/transport/buses
 * Returns buses that stop at a specific location
 */
router.post('/buses', validation.validateGetBuses, controller.getBuses);

/**
 * API 4 - POST /api/transport/fees
 * Returns fees for buses/stops
 */
router.post('/fees', validation.validateGetFees, controller.getFees);

/**
 * API 5 - POST /api/transport/add (protected)
 */
router.post('/add', protect, admin, validation.validateAddTransport, controller.addTransport);

/**
 * API 6 - POST /api/transport/bulk (protected)
 */
router.post('/bulk', protect, admin, validation.validateBulkAddTransport, controller.bulkAddTransport);

/**
 * API 7 - PUT /api/transport/:id (protected, propagates fee changes)
 */
router.put('/:id', protect, admin, validation.validateUpdateTransport, controller.updateTransport);

module.exports = router;
