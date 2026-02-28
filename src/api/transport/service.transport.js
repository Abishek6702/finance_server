const { Transport } = require("../transport/model.transport");

/**
 * API 1 - Get full transport mapping
 * Groups by route & busNo, collects stops
 */
const getFullMapping = async () => {
  // Fetch all transport documents using lean() for performance
  const transports = await Transport.find({}).lean();

  // In-memory grouping by route + busNo
  const groupMap = new Map();

  transports.forEach(doc => {
    const key = `${doc.route}|||${doc.busNo}`;
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        route: doc.route,
        busNo: doc.busNo,
        stops: []
      });
    }
    
    groupMap.get(key).stops.push({ id: doc._id, stop: doc.stop });
  });

  // Convert map to array
  return Array.from(groupMap.values());
};

/**
 * API 2 - Get stops by route and/or busNo
 * Supports filtering by route only, busNo only, or both
 */
const getStops = async (filters) => {
  const query = {};

  // Build query using indexed fields
  if (filters.route) {
    query.route = filters.route;
  }
  if (filters.busNo) {
    query.busNo = filters.busNo;
  }

  // Fetch matching documents with _id and stop field
  const transports = await Transport.find(query)
    .select('_id stop')
    .lean();

  // Extract unique stops and their IDs
  const seen = new Set();
  const uniqueStops = [];

  transports.forEach(t => {
    if (!seen.has(t.stop)) {
      seen.add(t.stop);
      uniqueStops.push({
        id: t._id,
        stop: t.stop
      });
    }
  });

  return uniqueStops;
};

/**
 * API 3 - Get buses at a specific stop
 * Returns unique busNo and route pairs
 */
const getBuses = async (stop) => {
  // Query by stop (indexed field)
  const transports = await Transport.find({ stop })
    .select('_id busNo route')
    .lean();

  // Deduplicate using Set with stringified objects
  const seen = new Set();
  const uniqueBuses = [];

  transports.forEach(t => {
    const key = `${t.busNo}|||${t.route}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBuses.push({
        id: t._id,
        busNo: t.busNo,
        route: t.route
      });
    }
  });

  return uniqueBuses;
};

/**
 * API 4 - Get fees for given busNo and/or stop
 */
const getFees = async (filters) => {
  const query = {};
  if (filters.busNo) query.busNo = filters.busNo;
  if (filters.stop) query.stop = filters.stop;

  const transports = await Transport.find(query)
    .select('route busNo stop fee')
    .lean();

  return transports;
};

module.exports = {
  getFullMapping,
  getStops,
  getBuses,
  getFees
};
