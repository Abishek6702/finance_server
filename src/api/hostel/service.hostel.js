const { Hostel } = require("../hostel/model.hostel");

/**
 * API 1 - Get full hostel mapping
 * Groups by block, collects roomTypes
 */
const getFullMapping = async () => {
  // Fetch all hostel documents using lean() for performance
  const hostels = await Hostel.find({}).lean();

  // In-memory grouping by block
  const groupMap = new Map();

  hostels.forEach(doc => {
    const key = doc.block;
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        block: doc.block,
        roomTypes: []
      });
    }
    
    groupMap.get(key).roomTypes.push({ 
      id: doc._id, 
      sharing: doc.sharing, 
      isAttached: doc.isAttached,
      fee: doc.fee
    });
  });

  // Convert map to array
  return Array.from(groupMap.values());
};

/**
 * API 2 - Get blocks by sharing and/or isAttached
 */
const getBlocks = async (filters) => {
  const query = {};

  if (filters.sharing !== undefined) {
    query.sharing = filters.sharing;
  }
  if (filters.isAttached !== undefined) {
    query.isAttached = filters.isAttached;
  }

  const hostels = await Hostel.find(query)
    .select('_id block')
    .lean();

  const seen = new Set();
  const uniqueBlocks = [];

  hostels.forEach(h => {
    if (!seen.has(h.block)) {
      seen.add(h.block);
      uniqueBlocks.push({
        id: h._id,
        block: h.block
      });
    }
  });

  return uniqueBlocks;
};

/**
 * API 3 - Get roomTypes by block
 */
const getRoomTypes = async (filters) => {
  const query = {};

  if (filters.block) {
    query.block = filters.block;
  }

  const hostels = await Hostel.find(query)
    .select('_id sharing isAttached')
    .lean();

  const seen = new Set();
  const uniqueRoomTypes = [];

  hostels.forEach(h => {
    const key = `${h.sharing}|||${h.isAttached}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoomTypes.push({
        id: h._id,
        sharing: h.sharing,
        isAttached: h.isAttached
      });
    }
  });

  return uniqueRoomTypes;
};

/**
 * API 4 - Get fees
 */
const getFees = async (filters) => {
  const query = {};
  if (filters.block) query.block = filters.block;
  if (filters.sharing !== undefined) query.sharing = filters.sharing;
  if (filters.isAttached !== undefined) query.isAttached = filters.isAttached;

  const hostels = await Hostel.find(query)
    .select('block sharing isAttached fee')
    .lean();

  return hostels;
};

module.exports = {
  getFullMapping,
  getBlocks,
  getRoomTypes,
  getFees
};
