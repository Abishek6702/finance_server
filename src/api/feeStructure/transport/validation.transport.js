const AppError = require("../../../utils/AppError");

const validateGetStops = (req, res, next) => {
  const { route, busNo } = req.body;

  if (route !== undefined) {
    if (typeof route !== 'string') return next(new AppError('route must be a string', 400));
    req.body.route = route.trim();
    if (req.body.route === '') return next(new AppError('route cannot be empty', 400));
  }

  if (busNo !== undefined) {
    if (typeof busNo !== 'string') return next(new AppError('busNo must be a string', 400));
    req.body.busNo = busNo.trim();
    if (req.body.busNo === '') return next(new AppError('busNo cannot be empty', 400));
  }

  next();
};

const validateGetBuses = (req, res, next) => {
  const { stop } = req.body;

  if (!stop) return next(new AppError('stop is required', 400));
  if (typeof stop !== 'string') return next(new AppError('stop must be a string', 400));

  req.body.stop = stop.trim();
  if (req.body.stop === '') return next(new AppError('stop cannot be empty', 400));

  next();
};

const validateGetFees = (req, res, next) => {
  const { busNo, stop } = req.body;

  if (busNo === undefined && stop === undefined) {
    return next(new AppError('At least one of busNo or stop is required', 400));
  }

  if (busNo !== undefined) {
    if (typeof busNo !== 'string') return next(new AppError('busNo must be a string', 400));
    req.body.busNo = busNo.trim();
    if (req.body.busNo === '') return next(new AppError('busNo cannot be empty', 400));
  }

  if (stop !== undefined) {
    if (typeof stop !== 'string') return next(new AppError('stop must be a string', 400));
    req.body.stop = stop.trim();
    if (req.body.stop === '') return next(new AppError('stop cannot be empty', 400));
  }

  next();
};

const validateAddTransport = (req, res, next) => {
  const { route, busNo, stop, fee } = req.body;

  if (!route || typeof route !== 'string' || route.trim() === '') {
    return next(new AppError('route is required and must be a non-empty string', 400));
  }
  if (!busNo || typeof busNo !== 'string' || busNo.trim() === '') {
    return next(new AppError('busNo is required and must be a non-empty string', 400));
  }
  if (!stop || typeof stop !== 'string' || stop.trim() === '') {
    return next(new AppError('stop is required and must be a non-empty string', 400));
  }
  if (fee === undefined || typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
    return next(new AppError('fee is required and must be a non-negative number', 400));
  }

  req.body.route = route.trim();
  req.body.busNo = busNo.trim();
  req.body.stop = stop.trim();
  next();
};

const validateBulkAddTransport = (req, res, next) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return next(new AppError('records array is required and must not be empty', 400));
  }

  for (let i = 0; i < records.length; i++) {
    const { route, busNo, stop, fee } = records[i];
    if (!route || typeof route !== 'string' || route.trim() === '') {
      return next(new AppError(`records[${i}].route is required and must be a non-empty string`, 400));
    }
    if (!busNo || typeof busNo !== 'string' || busNo.trim() === '') {
      return next(new AppError(`records[${i}].busNo is required and must be a non-empty string`, 400));
    }
    if (!stop || typeof stop !== 'string' || stop.trim() === '') {
      return next(new AppError(`records[${i}].stop is required and must be a non-empty string`, 400));
    }
    if (fee === undefined || typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
      return next(new AppError(`records[${i}].fee is required and must be a non-negative number`, 400));
    }
    records[i].route = route.trim();
    records[i].busNo = busNo.trim();
    records[i].stop = stop.trim();
  }

  next();
};

const validateUpdateTransport = (req, res, next) => {
  const { fee, route, busNo, stop } = req.body;

  if (fee === undefined && route === undefined && busNo === undefined && stop === undefined) {
    return next(new AppError('At least one field (fee, route, busNo, stop) is required for update', 400));
  }

  if (fee !== undefined) {
    if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
      return next(new AppError('fee must be a non-negative number', 400));
    }
  }
  if (route !== undefined) {
    if (typeof route !== 'string' || route.trim() === '') {
      return next(new AppError('route must be a non-empty string', 400));
    }
    req.body.route = route.trim();
  }
  if (busNo !== undefined) {
    if (typeof busNo !== 'string' || busNo.trim() === '') {
      return next(new AppError('busNo must be a non-empty string', 400));
    }
    req.body.busNo = busNo.trim();
  }
  if (stop !== undefined) {
    if (typeof stop !== 'string' || stop.trim() === '') {
      return next(new AppError('stop must be a non-empty string', 400));
    }
    req.body.stop = stop.trim();
  }

  next();
};

module.exports = {
  validateGetStops,
  validateGetBuses,
  validateGetFees,
  validateAddTransport,
  validateBulkAddTransport,
  validateUpdateTransport
};
