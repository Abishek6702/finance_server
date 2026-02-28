const bcrypt = require("bcrypt");
const User = require("../auth/model.user.js");
const ActivityLog = require("../../models/ActivityLog.js");
const sendMail = require("../../utils/sendMail");
const generateToken = require("../../utils/generateToken.js");
const AppError = require("../../utils/AppError");
 
exports.login = async (credentials, reqInfo) => {
  const { email, password } = credentials;
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", 404);

  const isPasswordValid = await bcrypt.compare(password, user.password);
   
  const log = (status, desc) => ActivityLog.create({
    user: user._id, module: "Auth", endpoint: reqInfo.url, 
    method: reqInfo.method, description: desc, meta: { email, status }
  });

  if (!isPasswordValid) {
    await log("FAILED", "LOGIN FAILED - wrong password");
    throw new AppError("Invalid password", 401);
  }

  await log("SUCCESS", "LOGIN SUCCESS");
  return {
    _id: user._id, name: user.name, email: user.email, role: user.role,
    firstTimeLogin: user.firstTimeLogin,
    token: generateToken(user._id, user.role, user.name, user.email),
  };
};

 

 

exports.logout = async (userId) => {
  // Can implement token invalidation if required, otherwise just return success
  return { message: "Logged out successfully" };
};