const authService = require("./serviceAuth");
const asyncHandler = require("../../utils/asyncHandler");

exports.login = asyncHandler(async (req, res) => {
  const reqInfo = { url: req.originalUrl, method: req.method };
  const data = await authService.login(req.body, reqInfo);
  res.status(200).json({ success: true, data, message: "Login successful" });
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  res.status(200).json({ success: true, data: null, message: "Logged out successfully" });
});