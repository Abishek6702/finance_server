const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  "https://finance-client-olive.vercel.app",
];

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});

module.exports = corsMiddleware;
