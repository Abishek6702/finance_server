const { Hostel } = require("./modelHostel");
const AppError = require("../../../utils/appError");

/**
 * Get all hostel configurations
 */
const getAllHostels = async () => {
  const hostels = await Hostel.find().lean();

  const blocks = [...new Set(hostels.map((item) => item.block))];
  const sharing = [...new Set(hostels.map((item) => item.sharing))];
  const isAttached = [...new Set(hostels.map((item) => item.isAttached))];

  return {
    info: {
      blocks,
      sharing,
      isAttached
    },
    detailed: hostels.map((item) => ({
      id: String(item._id),
      block: item.block,
      sharing: item.sharing,
      isAttached: item.isAttached,
      fee: item.fee
    }))
  };
};

/**
 * Create a single hostel configuration
 */
const createHostel = async (payload) => {
  try {
    const hostel = await Hostel.create(payload);
    return hostel;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Hostel configuration with this block, sharing, and attachment already exists", 409);
    }
    throw error;
  }
};

/**
 * Bulk create hostel configurations
 */
const bulkCreateHostels = async (payloads) => {
  try {
    // Attempt unordered insert so valid ones pass even if there are dupes,
    // but typically for a master seed we want them all to pass or fail.
    // Using ordered: false allows continuing on E11000.
    const result = await Hostel.insertMany(payloads, { ordered: false });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      // If ordered: false, error.insertedDocs has the successes
      throw new AppError(`Bulk insert partially failed due to duplicate entries. Inserted ${error.insertedDocs?.length || 0} documents.`, 409);
    }
    throw error;
  }
};

/**
 * Update the structural config of a hostel (block, sharing, isAttached)
 */
const updateHostelConfig = async (id, payload) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    
    if (!hostel) {
      throw new AppError("Hostel configuration not found", 404);
    }
    return hostel;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Update would cause a duplicate hostel configuration", 409);
    }
    throw error;
  }
};

/**
 * Update only the fee for a hostel
 */
const updateHostelFee = async (id, fee) => {
  const hostel = await Hostel.findByIdAndUpdate(
    id, 
    { fee }, 
    { new: true, runValidators: true }
  );
  
  if (!hostel) {
    throw new AppError("Hostel configuration not found", 404);
  }
  return hostel;
};

/**
 * Delete a hostel configuration
 */
const deleteHostel = async (id) => {
  const hostel = await Hostel.findByIdAndDelete(id);
  if (!hostel) {
    throw new AppError("Hostel configuration not found", 404);
  }
  return hostel;
};

module.exports = { 
  getAllHostels,
  createHostel,
  bulkCreateHostels,
  updateHostelConfig,
  updateHostelFee,
  deleteHostel
};
