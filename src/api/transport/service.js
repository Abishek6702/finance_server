const { Transport } = require('../../models/Transport');

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
    
    groupMap.get(key).stops.push(doc.stop);
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

  // Fetch matching documents with only stop field
  const transports = await Transport.find(query)
    .select('stop')
    .lean();

  // Extract unique stops using Set
  const uniqueStops = [...new Set(transports.map(t => t.stop))];

  return uniqueStops;
};

/**
 * API 3 - Get buses at a specific stop
 * Returns unique busNo and route pairs
 */
const getBuses = async (stop) => {
  // Query by stop (indexed field)
  const transports = await Transport.find({ stop })
    .select('busNo route')
    .lean();

  // Deduplicate using Set with stringified objects
  const seen = new Set();
  const uniqueBuses = [];

  transports.forEach(t => {
    const key = `${t.busNo}|||${t.route}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBuses.push({
        busNo: t.busNo,
        route: t.route
      });
    }
  });

  return uniqueBuses;
};

module.exports = {
  getFullMapping,
  getStops,
  getBuses
};
