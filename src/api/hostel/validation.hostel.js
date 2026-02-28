const validateGetBlocks = (req, res, next) => {
  // block filter is optional
  const { sharing, isAttached } = req.body;

  if (sharing !== undefined) {
    if (typeof sharing !== 'number' || ![2,3,4,5].includes(sharing)) {
      return res.status(400).json({
        success: false,
        message: 'sharing must be a number (2, 3, 4, 5)'
      });
    }
  }

  if (isAttached !== undefined) {
    if (typeof isAttached !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAttached must be a boolean'
      });
    }
  }

  next();
};

const validateGetRoomTypes = (req, res, next) => {
  const { block } = req.body;

  if (block !== undefined) {
    if (typeof block !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'block must be a string'
      });
    }
    req.body.block = block.trim().toUpperCase();
    if (req.body.block === '') {
      return res.status(400).json({
        success: false,
        message: 'block cannot be empty'
      });
    }
  }

  next();
};

const validateGetFees = (req, res, next) => {
  const { block, sharing, isAttached } = req.body;

  if (block === undefined && sharing === undefined && isAttached === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one of block, sharing, or isAttached is required'
    });
  }

  if (block !== undefined) {
    if (typeof block !== 'string') return res.status(400).json({ success: false, message: 'block must be a string' });
    req.body.block = block.trim().toUpperCase();
    if (req.body.block === '') return res.status(400).json({ success: false, message: 'block cannot be empty' });
  }

  if (sharing !== undefined) {
    if (typeof sharing !== 'number' || ![2,3,4,5].includes(sharing)) {
      return res.status(400).json({ success: false, message: 'sharing must be a number (2, 3, 4, 5)' });
    }
  }

  if (isAttached !== undefined) {
    if (typeof isAttached !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isAttached must be a boolean' });
    }
  }

  next();
};

module.exports = {
  validateGetBlocks,
  validateGetRoomTypes,
  validateGetFees
};
