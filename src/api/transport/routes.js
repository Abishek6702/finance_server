const express = require('express');
const router = express.Router();
const controller = require('./controller');
const validation = require('./validation');

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

module.exports = router;
