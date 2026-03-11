const express = require('express');
const router = express.Router();
const controller = require("./controller.transport");
const validation = require("./validation.transport");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");
 
module.exports = router;
