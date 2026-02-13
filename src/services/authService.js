const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const ActivityLog = require("../models/ActivityLog.js");
const sendMail = require("../utils/sendMail");
const generateToken = require("../utils/generateToken.js");
const renderTemplate = require("../utils/templateHandler");

exports.createAdmin = async (data) => {
  const { name, email, password, role } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error("User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);
  return await User.create({ name, email, password: hashedPassword, role: role || "admin" });
};

exports.login = async (credentials, reqInfo) => {
  const { email, password } = credentials;
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  // Log Activity Helper
  const log = (status, desc) => ActivityLog.create({
    user: user._id, module: "Auth", endpoint: reqInfo.url, 
    method: reqInfo.method, description: desc, meta: { email, status }
  });

  if (!isPasswordValid) {
    await log("FAILED", "LOGIN FAILED - wrong password");
    throw new Error("Invalid password");
  }

  await log("SUCCESS", "LOGIN SUCCESS");
  return {
    _id: user._id, name: user.name, email: user.email, role: user.role,
    firstTimeLogin: user.firstTimeLogin,
    token: generateToken(user._id, user.role, user.name, user.email),
  };
};

exports.forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetOtp = otp;
  user.resetOtpExpiry = Date.now() + 3600000;
  await user.save();

  const html = renderTemplate("ForgotPassword", { name: user.name, email: user.email, otp });
  await sendMail(user.email, "Password Reset OTP", html);
  return { message: "OTP sent to email" };
};

exports.resetPassword = async ({ email, otp, newPassword }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found for this email");

  if (!user.resetOtp || user.resetOtp !== otp || user.resetOtpExpiry < Date.now()) {
    throw new Error("Invalid or expired otp");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetOtp = user.resetOtpExpiry = undefined;
  await user.save();
  return { message: "Password changed successfully" };
};