const authService = require("./service");
 
exports.login = async (req, res) => {
  try {
    const reqInfo = { url: req.originalUrl, method: req.method };
    const data = await authService.login(req.body, reqInfo);
    
    res.cookie("token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000  
    });
    
    res.json(data);
  } catch (err) {
    const code = err.message === "User not found" ? 404 : err.message === "Invalid password" ? 401 : 500;
    res.status(code).json({ message: err.message });
   }
};

exports.logout = async (req, res) => {
  try {
    const result = await authService.logout(req.user.id);
    res.clearCookie("token");
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};