const authService = require("../services/authService");

exports.createAdmin = async (req, res) => {
  try {
    const user = await authService.createAdmin(req.body);
    res.status(201).json({ message: "Admin created", user });
  } catch (err) {
    res.status(err.message === "User already exists" ? 400 : 500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const reqInfo = { url: req.originalUrl, method: req.method };
    const data = await authService.login(req.body, reqInfo);
    res.json(data);
  } catch (err) {
    const code = err.message === "User not found" ? 404 : err.message === "Invalid password" ? 401 : 500;
    res.status(code).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    res.status(err.message === "User not found" ? 404 : 500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (err) {
    res.status(err.message === "Invalid or expired otp" ? 400 : 404).json({ message: err.message });
  }
};