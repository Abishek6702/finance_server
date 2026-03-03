const express = require('express');
const router = express.Router();
const controller = require("./controller.transport");
const validation = require("./validation.transport");
const { protect, admin, superadmin } = require("../../middleware/authMiddleware");

/**
 * API 1 - GET /api/transport
 * Returns full transport mapping grouped by route & busNo
 * Auth: Admin (admin + superadmin)
 */
router.get('/', protect, admin, controller.getFullMapping);

/**
 * API 2 - POST /api/transport/stops
 * Returns stops filtered by route and/or busNo
 * Auth: Superadmin only
 */
router.post('/stops', protect, superadmin, validation.validateGetStops, controller.getStops);

/**
 * API 3 - POST /api/transport/buses
 * Returns buses that stop at a specific location
 * Auth: Superadmin only
 */
router.post('/buses', protect, superadmin, validation.validateGetBuses, controller.getBuses);

/**
 * API 4 - POST /api/transport/fees
 * Returns fees for buses/stops
 * Auth: Superadmin only
 */
router.post('/fees', protect, superadmin, validation.validateGetFees, controller.getFees);

/**
 * API 5 - POST /api/transport/add (protected)
 * Auth: Superadmin only
 */
router.post('/add', protect, superadmin, validation.validateAddTransport, controller.addTransport);

/**
 * API 6 - POST /api/transport/bulk (protected)
 * Auth: Superadmin only
 */
router.post('/bulk', protect, superadmin, validation.validateBulkAddTransport, controller.bulkAddTransport);

/**
 * API 7 - PUT /api/transport/:id (protected, propagates fee changes)
 * Auth: Superadmin only
 */
router.put('/:id', protect, superadmin, validation.validateUpdateTransport, controller.updateTransport);

module.exports = router;
