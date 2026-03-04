const authService = require("./service.auth");
const asyncHandler = require("../../utils/asyncHandler");

exports.login = asyncHandler(async (req, res) => {
  const reqInfo = { url: req.originalUrl, method: req.method };
  const data = await authService.login(req.body, reqInfo);
   
const isLocal = process.env.NODE_ENV === "localdevelopment";
console.log("isLocal:", isLocal);
res.cookie("token", data.token, {
  httpOnly: true,
  sameSite: isLocal ? "lax" : "none",
  secure: !isLocal,
  maxAge: 30 * 24 * 60 * 60 * 1000
});
  
  res.status(200).json({ success: true, data, message: "Login successful" });
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  res.clearCookie("token");
  res.status(200).json({ success: true, data: null, message: "Logged out successfully" });
});