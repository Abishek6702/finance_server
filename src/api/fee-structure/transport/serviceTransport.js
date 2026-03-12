const { Transport } = require("./modelTransport");
const AppError = require("../../../utils/appError");

/**
 * Get all transport configurations
 */
const getAllTransportStops = async () => {
  return await Transport.find().lean();
};

/**
 * Create a single transport stop
 */
const createTransportStop = async (payload) => {
  try {
    const transport = await Transport.create(payload);
    return transport;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Transport stop for this route and bus number already exists", 409);
    }
    throw error;
  }
};

/**
 * Bulk create transport stops (from nested data.json layout or flat arrays)
 */
const bulkCreateTransportStops = async (payloads) => {
  try {
    const flatDocs = [];
    
    // Check if it's the nested seed format or a flat schema
    if (payloads.length > 0 && Array.isArray(payloads[0].stops)) {
      payloads.forEach(routeObj => {
        routeObj.stops.forEach(stopObj => {
          flatDocs.push({
            route: routeObj.route,
            busNo: routeObj.busNo,
            stop: stopObj.name,
            fee: stopObj.fee
          });
        });
      });
    } else {
      flatDocs.push(...payloads);
    }

    const result = await Transport.insertMany(flatDocs, { ordered: false });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(`Bulk insert partially failed due to duplicate entries. Inserted ${error.insertedDocs?.length || 0} documents.`, 409);
    }
    throw error;
  }
};

/**
 * Update the structural config of a transport stop (route, busNo, stop)
 */
const updateTransportConfig = async (id, payload) => {
  try {
    const transport = await Transport.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    
    if (!transport) {
      throw new AppError("Transport stop not found", 404);
    }
    return transport;
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Update would cause a duplicate transport configuration", 409);
    }
    throw error;
  }
};

/**
 * Update only the fee for a transport stop
 */
const updateTransportFee = async (id, fee) => {
  const transport = await Transport.findByIdAndUpdate(
    id, 
    { fee }, 
    { new: true, runValidators: true }
  );
  
  if (!transport) {
    throw new AppError("Transport stop not found", 404);
  }
  return transport;
};

/**
 * Delete a transport stop
 */
const deleteTransportStop = async (id) => {
  const transport = await Transport.findByIdAndDelete(id);
  if (!transport) {
    throw new AppError("Transport stop not found", 404);
  }
  return transport;
};

module.exports = { 
  getAllTransportStops,
  createTransportStop,
  bulkCreateTransportStops,
  updateTransportConfig,
  updateTransportFee,
  deleteTransportStop
};
