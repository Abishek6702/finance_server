const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const ActivityLog = require("../models/ActivityLog.js");
const sendMail = require("../utils/sendMail");
const generateToken = require("../utils/generateToken.js");
const renderTemplate = require("../utils/templateHandler");

class AuthService {
  async createAdmin(data) {
    const { name, email, password, role } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("User already exists");
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
    return newUser;
  }

  async login(credentials, requestData) {
    const { email, password } = credentials;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      await ActivityLog.create({
        user: user._id,
        module: "Auth",
        endpoint: requestData.originalUrl,
        method: requestData.method,
        description: "LOGIN FAILED - wrong password",
        meta: {
          email,
          status: "FAILED",
        },
      });
      throw new Error("Invalid password");
    }

    // Log successful login
    await ActivityLog.create({
      user: user._id,
      module: "Auth",
      endpoint: requestData.originalUrl,
      method: requestData.method,
      description: "LOGIN SUCCESS",
      meta: {
        email,
        status: "SUCCESS",
      },
    });

    // Return user data with token
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      firstTimeLogin: user.firstTimeLogin,
      token: generateToken(user._id, user.role, user.name, user.email),
    };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Send email with OTP
    const htmlContent = renderTemplate("ForgotPassword", {
      name: user.name,
      email: user.email,
      otp,
    });

    await sendMail(
      user.email,
      "Password Reset OTP - Sece Finance Portal",
      htmlContent
    );

    return { message: "OTP sent to email" };
  }

  async resetPassword(data) {
    const { email, otp, newPassword } = data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found for this email");
    }

    // Validate OTP
    if (
      !user.resetOtp ||
      user.resetOtp != otp ||
      user.resetOtpExpiry < Date.now()
    ) {
      throw new Error("Invalid or expired otp");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;

    await user.save();
    return { message: "Password changed sucessfully" };
  }
}

module.exports = new AuthService();
