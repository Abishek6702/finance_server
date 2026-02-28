const hostelService = require("./service.hostel");

/**
 * API 1 - GET /api/hostel
 * Returns full hostel mapping
 */
const getFullMapping = async (req, res) => {
  try {
    const data = await hostelService.getFullMapping();

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getFullMapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hostel mapping'
    });
  }
};

/**
 * API 2 - POST /api/hostel/blocks
 * Returns blocks filtered by specified room types
 */
const getBlocks = async (req, res) => {
  try {
    const filters = {
      sharing: req.body.sharing,
      isAttached: req.body.isAttached
    };

    const data = await hostelService.getBlocks(filters);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getBlocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocks'
    });
  }
};

/**
 * API 3 - POST /api/hostel/roomTypes
 * Returns roomTypes for a block
 */
const getRoomTypes = async (req, res) => {
  try {
    const filters = {
      block: req.body.block
    };

    const data = await hostelService.getRoomTypes(filters);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getRoomTypes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room types'
    });
  }
};

/**
 * API 4 - POST /api/hostel/fees
 * Returns fees
 */
const getFees = async (req, res) => {
  try {
    const filters = {
      block: req.body.block,
      sharing: req.body.sharing,
      isAttached: req.body.isAttached
    };

    const data = await hostelService.getFees(filters);

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
  getBlocks,
  getRoomTypes,
  getFees
};
