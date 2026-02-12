const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const fs = require("fs");
const path = require("path");
dotenv.config();

const app = express();

const allowedOrigins = ["http://localhost:5173","https://finance-client-olive.vercel.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);
connectDB();

app.use(express.json());
app.use("/assets", express.static("public/assets"));

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);

// Global error handler for unhandled routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
