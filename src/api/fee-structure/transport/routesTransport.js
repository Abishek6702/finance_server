const express = require('express');
const router = express.Router();
const controller = require("./controllerTransport");
const validation = require("./validationTransport");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");
 
module.exports = router;
