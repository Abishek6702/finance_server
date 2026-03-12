const AppError = require("../../../utils/appError");

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const validateIdParam = (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return next(new AppError("Invalid MongoDB ID format", 400));
  }
  next();
};

const validateCreate = (req, res, next) => {
  const { block, sharing, isAttached, fee } = req.body;
  if (!block || !["A", "B", "C", "D", "E", "F"].includes(block.toUpperCase())) {
    return next(new AppError("Valid block is required (A, B, C, D, E, F)", 400));
  }
  if (!sharing || ![2, 3, 4, 5].includes(Number(sharing))) {
    return next(new AppError("Valid sharing capacity is required (2, 3, 4, 5)", 400));
  }
  if (typeof isAttached !== "boolean") {
    return next(new AppError("isAttached boolean is required", 400));
  }
  if (fee === undefined || typeof fee !== "number" || fee < 0) {
    return next(new AppError("Valid positive integer fee is required", 400));
  }
  next();
};

const validateBulkCreate = (req, res, next) => {
  const payloads = req.body;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return next(new AppError("Request body must be a non-empty array of hostel configurations", 400));
  }
  
  for (let i = 0; i < payloads.length; i++) {
    const { block, sharing, isAttached, fee } = payloads[i];
    if (!block || !["A", "B", "C", "D", "E", "F"].includes(block.toUpperCase())) return next(new AppError(`Invalid block at index ${i}`, 400));
    if (!sharing || ![2, 3, 4, 5].includes(Number(sharing))) return next(new AppError(`Invalid sharing at index ${i}`, 400));
    if (typeof isAttached !== "boolean") return next(new AppError(`Invalid isAttached at index ${i}`, 400));
    if (fee === undefined || typeof fee !== "number" || fee < 0) return next(new AppError(`Invalid fee at index ${i}`, 400));
  }
  next();
};

const validateUpdateFee = (req, res, next) => {
  const { fee } = req.body;
  if (fee === undefined || typeof fee !== "number" || fee < 0) {
    return next(new AppError("Valid positive integer fee is required", 400));
  }
  next();
};

module.exports = { 
  validateIdParam,
  validateCreate,
  validateBulkCreate,
  validateUpdateFee
};
