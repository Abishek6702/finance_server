const { Transport, getNextTransportId } = require("../transport/model.transport");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const AppError = require("../../utils/AppError");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

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
    
    groupMap.get(key).stops.push({ id: doc.id, stop: doc.stop });
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

  // Fetch matching documents with id and stop field
  const transports = await Transport.find(query)
    .select('id stop')
    .lean();

  // Extract unique stops and their IDs
  const seen = new Set();
  const uniqueStops = [];

  transports.forEach(t => {
    if (!seen.has(t.stop)) {
      seen.add(t.stop);
      uniqueStops.push({
        id: t.id,
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
    .select('id busNo route')
    .lean();

  // Deduplicate using Set with stringified objects
  const seen = new Set();
  const uniqueBuses = [];

  transports.forEach(t => {
    const key = `${t.busNo}|||${t.route}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBuses.push({
        id: t.id,
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
    .select('id route busNo stop fee')
    .lean();

  return transports;
};

/**
 * Add a single transport record
 */
const addTransport = async (data) => {
  const existing = await Transport.findOne({ route: data.route, busNo: data.busNo, stop: data.stop });
  if (existing) throw new AppError(`Transport record already exists for route: ${data.route}, busNo: ${data.busNo}, stop: ${data.stop}`, 409);
  data.id = await getNextTransportId();
  return await Transport.create(data);
};

/**
 * Bulk add transport records
 */
const bulkAddTransport = async (records) => {
  const created = [];
  const failed = [];

  for (let i = 0; i < records.length; i++) {
    try {
      const existing = await Transport.findOne({ route: records[i].route, busNo: records[i].busNo, stop: records[i].stop });
      if (existing) throw new AppError('Duplicate: record already exists', 409);
      records[i].id = await getNextTransportId();
      const doc = await Transport.create(records[i]);
      created.push({ index: i, id: doc.id, route: doc.route, busNo: doc.busNo, stop: doc.stop });
    } catch (err) {
      failed.push({ index: i, route: records[i].route, busNo: records[i].busNo, stop: records[i].stop, reason: err.message });
    }
  }

  return { created, failed };
};

/**
 * Propagate transport fee change to all student tracking records
 */
const propagateTransportFeeUpdate = async (transportId, newFee) => {
  const trackingRecords = await StudentFeeTracking.find({
    "academicYearWiseRecord.transport.transport": transportId
  });

  let updatedCount = 0;
  for (const tracking of trackingRecords) {
    let modified = false;
    for (const yearRecord of tracking.academicYearWiseRecord) {
      if (yearRecord.transport &&
          yearRecord.transport.transport &&
          yearRecord.transport.transport.toString() === transportId.toString()) {
        yearRecord.transport.subTotal = normalizeMoney(newFee);
        modified = true;
      }
    }
    if (modified) {
      tracking.markModified("academicYearWiseRecord");
      await tracking.save();
      updatedCount++;
    }
  }
  return updatedCount;
};

/**
 * Update a transport record by ID and propagate fee changes to tracking
 */
const updateTransport = async (id, data) => {
  const existing = await Transport.findOne({ id });
  if (!existing) throw new AppError('Transport record not found', 404);

  const oldFee = existing.fee;
  const updateFields = {};
  if (data.route !== undefined) updateFields.route = data.route;
  if (data.busNo !== undefined) updateFields.busNo = data.busNo;
  if (data.stop !== undefined) updateFields.stop = data.stop;
  if (data.fee !== undefined) updateFields.fee = data.fee;

  const updated = await Transport.findOneAndUpdate({ id }, updateFields, { new: true, runValidators: true });
  if (!updated) throw new AppError('Transport record not found', 404);

  // Propagate fee change to student tracking if fee changed
  let trackingUpdated = 0;
  if (data.fee !== undefined && data.fee !== oldFee) {
    trackingUpdated = await propagateTransportFeeUpdate(id, data.fee);
  }

  return { transport: updated, trackingRecordsUpdated: trackingUpdated };
};

module.exports = {
  getFullMapping,
  getStops,
  getBuses,
  getFees,
  addTransport,
  bulkAddTransport,
  updateTransport
};
