const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  "https://finance-client-olive.vercel.app",
];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  credentials: true,
});

module.exports = corsMiddleware;