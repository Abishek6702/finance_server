const authService = require("../services/authService");

exports.createAdmin = async (req, res) => {
  try {
    const newUser = await authService.createAdmin(req.body);
    res
      .status(201)
      .json({ message: "Admin created successfully", user: newUser });
  } catch (error) {
    const statusCode = error.message === "User already exists" ? 400 : 500;
    res.status(statusCode).json({ message: error.message || "Error in creating admin", error });
  }
};

exports.login = async (req, res) => {
  try {
    const requestData = {
      originalUrl: req.originalUrl,
      method: req.method,
    };
    const userData = await authService.login(req.body, requestData);
    res.json(userData);
  } catch (error) {
    const statusCode = error.message === "User not found" ? 404 : 
                       error.message === "Invalid password" ? 401 : 500;
    res.status(statusCode).json({ message: error.message || "Error in login", error });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  } catch (error) {
    const statusCode = error.message === "User not found" ? 404 : 500;
    res.status(statusCode).json({ message: error.message || "Error in forgot password", error });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (error) {
    const statusCode = error.message === "User not found for this email" ? 404 :
                       error.message === "Invalid or expired otp" ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};