const express = require('express');
const router = express.Router();
const controller = require("./controllerHostel");
const validation = require("./validationHostel");
const { protect, admin, superadmin } = require("../../../middleware/authMiddleware");
 
module.exports = router;
