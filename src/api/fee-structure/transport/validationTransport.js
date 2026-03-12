const AppError = require("../../../utils/appError");

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const validateIdParam = (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return next(new AppError("Invalid MongoDB ID format", 400));
  }
  next();
};

const validateCreate = (req, res, next) => {
  const { route, busNo, stop, fee } = req.body;
  if (!route || typeof route !== "string" || route.trim() === "") {
    return next(new AppError("Valid route string is required", 400));
  }
  if (!busNo || typeof busNo !== "string" || busNo.trim() === "") {
    return next(new AppError("Valid busNo string is required", 400));
  }
  if (!stop || typeof stop !== "string" || stop.trim() === "") {
    return next(new AppError("Valid stop string is required", 400));
  }
  if (fee === undefined || typeof fee !== "number" || fee < 0) {
    return next(new AppError("Valid positive integer fee is required", 400));
  }
  next();
};

const validateBulkCreate = (req, res, next) => {
  const payloads = req.body;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return next(new AppError("Request body must be a non-empty array", 400));
  }
  
  // Can be the flattened layout or the nested layout
  if (payloads[0] && Array.isArray(payloads[0].stops)) {
    // Validate Nested
    for (let i = 0; i < payloads.length; i++) {
        const { route, busNo, stops } = payloads[i];
        if (!route || typeof route !== "string") return next(new AppError(`Invalid route at index ${i}`, 400));
        if (!busNo || typeof busNo !== "string") return next(new AppError(`Invalid busNo at index ${i}`, 400));
        if (!stops || !Array.isArray(stops)) return next(new AppError(`Invalid stops array at index ${i}`, 400));
        
        for (let j = 0; j < stops.length; j++) {
            const { name, fee } = stops[j];
            if (!name || typeof name !== "string") return next(new AppError(`Invalid stop name at index ${i}, stop ${j}`, 400));
            if (fee === undefined || typeof fee !== "number" || fee < 0) return next(new AppError(`Invalid fee at index ${i}, stop ${j}`, 400));
        }
    }
  } else {
    // Validate Flat
    for (let i = 0; i < payloads.length; i++) {
        const { route, busNo, stop, fee } = payloads[i];
        if (!route || typeof route !== "string") return next(new AppError(`Invalid route at index ${i}`, 400));
        if (!busNo || typeof busNo !== "string") return next(new AppError(`Invalid busNo at index ${i}`, 400));
        if (!stop || typeof stop !== "string") return next(new AppError(`Invalid stop at index ${i}`, 400));
        if (fee === undefined || typeof fee !== "number" || fee < 0) return next(new AppError(`Invalid fee at index ${i}`, 400));
    }
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
