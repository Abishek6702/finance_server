const transportService = require("./service.transport");

/**
 * API 1 - GET /api/transport
 * Returns full transport mapping grouped by route & busNo
 */
const getFullMapping = async (req, res) => {
  try {
    const data = await transportService.getFullMapping();

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getFullMapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transport mapping'
    });
  }
};

/**
 * API 2 - POST /api/transport/stops
 * Returns stops filtered by route and/or busNo
 */
const getStops = async (req, res) => {
  try {
    const filters = {
      route: req.body.route,
      busNo: req.body.busNo
    };

    const data = await transportService.getStops(filters);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getStops:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stops'
    });
  }
};

/**
 * API 3 - POST /api/transport/buses
 * Returns buses that stop at a specific location
 */
const getBuses = async (req, res) => {
  try {
    const { stop } = req.body;

    const data = await transportService.getBuses(stop);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getBuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch buses'
    });
  }
};

/**
 * API 4 - POST /api/transport/fees
 * Returns fees based on busNo, stop, or both
 */
const getFees = async (req, res) => {
  try {
    const filters = {
      busNo: req.body.busNo,
      stop: req.body.stop
    };

    const data = await transportService.getFees(filters);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getFees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fees'
    });
  }
};

module.exports = {
  getFullMapping,
  getStops,
  getBuses,
  getFees
};
