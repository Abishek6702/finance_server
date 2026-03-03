const express = require('express');
const router = express.Router();
const controller = require("./controller.hostel");
const validation = require("./validation.hostel");
const { protect, admin, superadmin } = require("../../middleware/authMiddleware");

/**
 * API 1 - GET /api/hostel
 * Returns full hostel mapping grouped by block
 * Auth: Admin (admin + superadmin)
 */
router.get('/', protect, admin, controller.getFullMapping);

/**
 * API 2 - POST /api/hostel/blocks
 * Returns blocks filtered by roomType (sharing, isAttached)
 * Auth: Superadmin only
 */
router.post('/blocks', protect, superadmin, validation.validateGetBlocks, controller.getBlocks);

/**
 * API 3 - POST /api/hostel/roomTypes
 * Returns roomTypes for a specific block
 * Auth: Superadmin only
 */
router.post('/roomTypes', protect, superadmin, validation.validateGetRoomTypes, controller.getRoomTypes);

/**
 * API 4 - POST /api/hostel/fees
 * Returns fees
 * Auth: Superadmin only
 */
router.post('/fees', protect, superadmin, validation.validateGetFees, controller.getFees);

/**
 * API 5 - POST /api/hostel/add (protected)
 * Auth: Superadmin only
 */
router.post('/add', protect, superadmin, validation.validateAddHostel, controller.addHostel);

/**
 * API 6 - POST /api/hostel/bulk (protected)
 * Auth: Superadmin only
 */
router.post('/bulk', protect, superadmin, validation.validateBulkAddHostel, controller.bulkAddHostel);

/**
 * API 7 - PUT /api/hostel/:id (protected, propagates fee changes)
 * Auth: Superadmin only
 */
router.put('/:id', protect, superadmin, validation.validateUpdateHostel, controller.updateHostel);

module.exports = router;
