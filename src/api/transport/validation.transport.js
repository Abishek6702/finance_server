const validateGetStops = (req, res, next) => {
  const { route, busNo } = req.body;

  // Both are optional, but if provided must be valid
  if (route !== undefined) {
    if (typeof route !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'route must be a string'
      });
    }
    req.body.route = route.trim();
    if (req.body.route === '') {
      return res.status(400).json({
        success: false,
        message: 'route cannot be empty'
      });
    }
  }

  if (busNo !== undefined) {
    if (typeof busNo !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'busNo must be a string'
      });
    }
    req.body.busNo = busNo.trim();
    if (req.body.busNo === '') {
      return res.status(400).json({
        success: false,
        message: 'busNo cannot be empty'
      });
    }
  }

  next();
};

const validateGetBuses = (req, res, next) => {
  const { stop } = req.body;

  // stop is required
  if (!stop) {
    return res.status(400).json({
      success: false,
      message: 'stop is required'
    });
  }

  if (typeof stop !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'stop must be a string'
    });
  }

  req.body.stop = stop.trim();
  
  if (req.body.stop === '') {
    return res.status(400).json({
      success: false,
      message: 'stop cannot be empty'
    });
  }

  next();
};

const validateGetFees = (req, res, next) => {
  const { busNo, stop } = req.body;

  if (busNo === undefined && stop === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one of busNo or stop is required'
    });
  }

  if (busNo !== undefined) {
    if (typeof busNo !== 'string') return res.status(400).json({ success: false, message: 'busNo must be a string' });
    req.body.busNo = busNo.trim();
    if (req.body.busNo === '') return res.status(400).json({ success: false, message: 'busNo cannot be empty' });
  }

  if (stop !== undefined) {
    if (typeof stop !== 'string') return res.status(400).json({ success: false, message: 'stop must be a string' });
    req.body.stop = stop.trim();
    if (req.body.stop === '') return res.status(400).json({ success: false, message: 'stop cannot be empty' });
  }

  next();
};

module.exports = {
  validateGetStops,
  validateGetBuses,
  validateGetFees
};
