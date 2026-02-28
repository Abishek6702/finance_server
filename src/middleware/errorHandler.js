const AppError = require("../utils/AppError");

const mapMongooseError = (error) => {
  if (error?.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((item) => item.message)
      .join(", ");
    return new AppError(message || "Validation failed", 400);
  }

  if (error?.name === "CastError") {
    return new AppError(`Invalid ${error.path}`, 400);
  }

  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue || {});
    const key = fields.length ? fields.join(", ") : "field";
    return new AppError(`${key} already exists`, 409);
  }

  return null;
};

const notFoundHandler = (req, res, next) => {
  next(new AppError("Route not found", 404));
};

const errorHandler = (error, req, res, next) => {
  const mapped = mapMongooseError(error);
  const finalError = mapped || error;

  const statusCode = finalError.statusCode || 500;
  const message = finalError.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
