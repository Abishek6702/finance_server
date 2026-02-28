const AppError = require("../../utils/AppError");

const validateGetBlocks = (req, res, next) => {
  const { sharing, isAttached } = req.body;

  if (sharing !== undefined) {
    if (typeof sharing !== 'number' || ![2,3,4,5].includes(sharing)) {
      return next(new AppError('sharing must be a number (2, 3, 4, 5)', 400));
    }
  }

  if (isAttached !== undefined) {
    if (typeof isAttached !== 'boolean') {
      return next(new AppError('isAttached must be a boolean', 400));
    }
  }

  next();
};

const validateGetRoomTypes = (req, res, next) => {
  const { block } = req.body;

  if (block !== undefined) {
    if (typeof block !== 'string') {
      return next(new AppError('block must be a string', 400));
    }
    req.body.block = block.trim().toUpperCase();
    if (req.body.block === '') {
      return next(new AppError('block cannot be empty', 400));
    }
  }

  next();
};

const validateGetFees = (req, res, next) => {
  const { block, sharing, isAttached } = req.body;

  if (block === undefined && sharing === undefined && isAttached === undefined) {
    return next(new AppError('At least one of block, sharing, or isAttached is required', 400));
  }

  if (block !== undefined) {
    if (typeof block !== 'string') return next(new AppError('block must be a string', 400));
    req.body.block = block.trim().toUpperCase();
    if (req.body.block === '') return next(new AppError('block cannot be empty', 400));
  }

  if (sharing !== undefined) {
    if (typeof sharing !== 'number' || ![2,3,4,5].includes(sharing)) {
      return next(new AppError('sharing must be a number (2, 3, 4, 5)', 400));
    }
  }

  if (isAttached !== undefined) {
    if (typeof isAttached !== 'boolean') {
      return next(new AppError('isAttached must be a boolean', 400));
    }
  }

  next();
};

const validateAddHostel = (req, res, next) => {
  const { block, sharing, isAttached, fee } = req.body;

  if (!block || typeof block !== 'string' || block.trim() === '') {
    return next(new AppError('block is required and must be a non-empty string', 400));
  }
  if (sharing === undefined || typeof sharing !== 'number' || ![2, 3, 4, 5].includes(sharing)) {
    return next(new AppError('sharing is required and must be one of: 2, 3, 4, 5', 400));
  }
  if (isAttached === undefined || typeof isAttached !== 'boolean') {
    return next(new AppError('isAttached is required and must be a boolean', 400));
  }
  if (fee === undefined || typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
    return next(new AppError('fee is required and must be a non-negative number', 400));
  }

  req.body.block = block.trim().toUpperCase();
  next();
};

const validateBulkAddHostel = (req, res, next) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return next(new AppError('records array is required and must not be empty', 400));
  }

  for (let i = 0; i < records.length; i++) {
    const { block, sharing, isAttached, fee } = records[i];
    if (!block || typeof block !== 'string' || block.trim() === '') {
      return next(new AppError(`records[${i}].block is required and must be a non-empty string`, 400));
    }
    if (sharing === undefined || typeof sharing !== 'number' || ![2, 3, 4, 5].includes(sharing)) {
      return next(new AppError(`records[${i}].sharing must be one of: 2, 3, 4, 5`, 400));
    }
    if (isAttached === undefined || typeof isAttached !== 'boolean') {
      return next(new AppError(`records[${i}].isAttached must be a boolean`, 400));
    }
    if (fee === undefined || typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
      return next(new AppError(`records[${i}].fee must be a non-negative number`, 400));
    }
    records[i].block = block.trim().toUpperCase();
  }

  next();
};

const validateUpdateHostel = (req, res, next) => {
  const { fee, block, sharing, isAttached } = req.body;

  if (fee === undefined && block === undefined && sharing === undefined && isAttached === undefined) {
    return next(new AppError('At least one field (fee, block, sharing, isAttached) is required for update', 400));
  }

  if (fee !== undefined) {
    if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
      return next(new AppError('fee must be a non-negative number', 400));
    }
  }
  if (block !== undefined) {
    if (typeof block !== 'string' || block.trim() === '') {
      return next(new AppError('block must be a non-empty string', 400));
    }
    req.body.block = block.trim().toUpperCase();
  }
  if (sharing !== undefined) {
    if (typeof sharing !== 'number' || ![2, 3, 4, 5].includes(sharing)) {
      return next(new AppError('sharing must be one of: 2, 3, 4, 5', 400));
    }
  }
  if (isAttached !== undefined) {
    if (typeof isAttached !== 'boolean') {
      return next(new AppError('isAttached must be a boolean', 400));
    }
  }

  next();
};

module.exports = {
  validateGetBlocks,
  validateGetRoomTypes,
  validateGetFees,
  validateAddHostel,
  validateBulkAddHostel,
  validateUpdateHostel
};
