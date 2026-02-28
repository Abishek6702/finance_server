const express = require("express");
const router = express.Router();
const authController = require("./controller.auth");
const { protect } = require("../../middleware/authMiddleware");
 
router.post("/login", authController.login);
router.post("/logout", protect, authController.logout);

module.exports = router;

