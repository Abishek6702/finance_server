const jwt = require("jsonwebtoken");

const generateToken = (id, role,name,email) => {
  return jwt.sign({ id, role, name,email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = generateToken;
