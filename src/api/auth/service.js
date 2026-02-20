const bcrypt = require("bcrypt");
const User = require("../../models/User.js");
const ActivityLog = require("../../models/ActivityLog.js");
const sendMail = require("../../utils/sendMail");
const generateToken = require("../../utils/generateToken.js");
const renderTemplate = require("../../utils/templateHandler");
 
exports.login = async (credentials, reqInfo) => {
  const { email, password } = credentials;
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.password);
   
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

exports.changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) throw new Error("Invalid old password");

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { message: "Password updated successfully" };
};

exports.logout = async (userId) => {
  // Can implement token invalidation if required, otherwise just return success
  return { message: "Logged out successfully" };
};