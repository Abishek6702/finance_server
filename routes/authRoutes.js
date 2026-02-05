const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register a admin
router.post("/create-admin", authController.createAdmin);
// Login
router.post("/login", authController.login);
// Forgot password
router.post("/forgot-password", authController.forgotPassword);
// Reset password
router.post("/reset-password", authController.resetPassword);

module.exports = router;
