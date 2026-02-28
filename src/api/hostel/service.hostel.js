const mongoose = require("mongoose");
const { Hostel } = require("../hostel/model.hostel");
const StudentFeeTracking = require("../studentFeeTracking/model.studentFeeTracking");
const AppError = require("../../utils/AppError");

const normalizeMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
};

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

/**
 * Add a single hostel record
 */
const addHostel = async (data) => {
  const existing = await Hostel.findOne({ block: data.block, sharing: data.sharing, isAttached: data.isAttached });
  if (existing) throw new AppError(`Hostel record already exists for block: ${data.block}, sharing: ${data.sharing}, isAttached: ${data.isAttached}`, 409);
  return await Hostel.create(data);
};

/**
 * Bulk add hostel records
 */
const bulkAddHostel = async (records) => {
  const created = [];
  const failed = [];

  for (let i = 0; i < records.length; i++) {
    try {
      const existing = await Hostel.findOne({ block: records[i].block, sharing: records[i].sharing, isAttached: records[i].isAttached });
      if (existing) throw new AppError('Duplicate: record already exists', 409);
      const doc = await Hostel.create(records[i]);
      created.push({ index: i, id: doc._id, block: doc.block, sharing: doc.sharing, isAttached: doc.isAttached });
    } catch (err) {
      failed.push({ index: i, block: records[i].block, sharing: records[i].sharing, isAttached: records[i].isAttached, reason: err.message });
    }
  }

  return { created, failed };
};

/**
 * Propagate hostel fee change to all student tracking records
 */
const propagateHostelFeeUpdate = async (hostelId, newFee) => {
  const objectId = new mongoose.Types.ObjectId(hostelId);
  const trackingRecords = await StudentFeeTracking.find({
    "academicYearWiseRecord.hostel.hostel": objectId
  });

  let updatedCount = 0;
  for (const tracking of trackingRecords) {
    let modified = false;
    for (const yearRecord of tracking.academicYearWiseRecord) {
      if (yearRecord.hostel &&
          yearRecord.hostel.hostel &&
          yearRecord.hostel.hostel.toString() === hostelId.toString()) {
        yearRecord.hostel.subTotal = normalizeMoney(newFee);
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
 * Update a hostel record by ID and propagate fee changes to tracking
 */
const updateHostel = async (id, data) => {
  const existing = await Hostel.findById(id);
  if (!existing) throw new AppError('Hostel record not found', 404);

  const oldFee = existing.fee;
  const updateFields = {};
  if (data.block !== undefined) updateFields.block = data.block;
  if (data.sharing !== undefined) updateFields.sharing = data.sharing;
  if (data.isAttached !== undefined) updateFields.isAttached = data.isAttached;
  if (data.fee !== undefined) updateFields.fee = data.fee;

  const updated = await Hostel.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
  if (!updated) throw new AppError('Hostel record not found', 404);

  // Propagate fee change to student tracking if fee changed
  let trackingUpdated = 0;
  if (data.fee !== undefined && data.fee !== oldFee) {
    trackingUpdated = await propagateHostelFeeUpdate(id, data.fee);
  }

  return { hostel: updated, trackingRecordsUpdated: trackingUpdated };
};

module.exports = {
  getFullMapping,
  getBlocks,
  getRoomTypes,
  getFees,
  addHostel,
  bulkAddHostel,
  updateHostel
};
