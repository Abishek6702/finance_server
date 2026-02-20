const express = require("express");
const router = express.Router();
const authController = require("./controller");
const { protect } = require("../../middleware/authMiddleware");
 
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", protect, authController.changePassword);
router.post("/logout", protect, authController.logout);

module.exports = router;

