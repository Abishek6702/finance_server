const hostelService = require("./service.hostel");
const asyncHandler = require("../../utils/asyncHandler");

const getFullMapping = asyncHandler(async (req, res) => {
  const data = await hostelService.getFullMapping();
  res.status(200).json({ success: true, data, message: "Hostel mapping fetched successfully" });
});

const getBlocks = asyncHandler(async (req, res) => {
  const filters = {
    sharing: req.body.sharing,
    isAttached: req.body.isAttached
  };
  const data = await hostelService.getBlocks(filters);
  res.status(200).json({ success: true, data, message: "Blocks fetched successfully" });
});

const getRoomTypes = asyncHandler(async (req, res) => {
  const filters = { block: req.body.block };
  const data = await hostelService.getRoomTypes(filters);
  res.status(200).json({ success: true, data, message: "Room types fetched successfully" });
});

const getFees = asyncHandler(async (req, res) => {
  const filters = {
    block: req.body.block,
    sharing: req.body.sharing,
    isAttached: req.body.isAttached
  };
  const data = await hostelService.getFees(filters);
  res.status(200).json({ success: true, data, message: "Fees fetched successfully" });
});

const addHostel = asyncHandler(async (req, res) => {
  const data = await hostelService.addHostel(req.body);
  res.status(201).json({ success: true, data, message: "Hostel record added successfully" });
});

const bulkAddHostel = asyncHandler(async (req, res) => {
  const result = await hostelService.bulkAddHostel(req.body.records);
  const status = result.failed.length === 0 ? 201 : 207;
  res.status(status).json({
    success: true,
    data: {
      summary: {
        total: req.body.records.length,
        created: result.created.length,
        failed: result.failed.length
      },
      created: result.created,
      failed: result.failed
    },
    message: result.failed.length === 0
      ? "All hostel records created successfully"
      : `${result.created.length} created, ${result.failed.length} failed`
  });
});

const updateHostel = asyncHandler(async (req, res) => {
  const result = await hostelService.updateHostel(req.params.id, req.body);
  res.status(200).json({
    success: true,
    data: { hostel: result.hostel, trackingRecordsUpdated: result.trackingRecordsUpdated },
    message: "Hostel record updated successfully"
  });
});

module.exports = {
  getFullMapping,
  getBlocks,
  getRoomTypes,
  getFees,
  addHostel,
  bulkAddHostel,
  updateHostel
};
