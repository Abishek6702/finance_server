const express = require('express');
const router = express.Router();
const controller = require("./controller.hostel");
const validation = require("./validation.hostel");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");
 
module.exports = router;
