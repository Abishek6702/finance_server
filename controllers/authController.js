const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const jwt = require("jsonwebtoken");

const ActivityLog = require("../models/ActivityLog.js");
const sendMail = require("../utils/sendMail");
const generateToken = require("../utils/generateToken.js");
const renderTemplate = require("../utils/templateHandler");


exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create new user with admin role
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "admin", // Default to admin if role is not provided
    });
    await newUser.save();
    res
      .status(201)
      .json({ message: "Admin created successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error in creating admin", error });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await ActivityLog.create({
        user: user._id,
        module: "Auth",
        endpoint: req.originalUrl,
        method: req.method,
        description: "LOGIN FAILED - wrong password",
        meta: {
          email,

          status: "FAILED",
        },
      });
      return res.status(401).json({ message: "Invalid password" });
    }

    // ✅ LOGIN SUCCESS
    await ActivityLog.create({
      user: user._id,
      module: "Auth",
      endpoint: req.originalUrl,
      method: req.method,
      description: "LOGIN SUCCESS",
      meta: {
        email,

        status: "SUCCESS",
      },
    });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      firstTimeLogin: user.firstTimeLogin,
      token: generateToken(user._id, user.role, user.name, user.email),
    });
  } catch (error) {
    res.status(500).json({ message: "Error in login", error });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetOtp = otp;
      user.resetOtpExpiry = Date.now() + 3600000;
      await user.save();

      const htmlContent = renderTemplate("ForgotPassword", {
        name: user.name,
        email: user.email,
        otp,
      });
      await sendMail(
        user.email,
        "Password Reset OTP - Sece Finance Portal",
        htmlContent,
      );
      res.json({ message: "OTP sent to email" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error in forgot password", error });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found for this email" });
    if (
      !user.resetOtp ||
      user.resetOtp != otp ||
      user.resetOtpExpiry < Date.now()
    ) {
      return res.status(404).json({ message: "Invalid or expired otp" });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;

    await user.save();
    res.json({ message: "Password changed sucessfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};