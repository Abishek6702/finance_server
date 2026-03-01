const transportService = require("./service.transport");
const asyncHandler = require("../../utils/asyncHandler");

const getFullMapping = asyncHandler(async (req, res) => {
  const data = await transportService.getFullMapping();
  res.status(200).json({ success: true, data, message: "Transport mapping fetched successfully" });
});

const getStops = asyncHandler(async (req, res) => {
  const filters = { route: req.body.route, busNo: req.body.busNo };
  const data = await transportService.getStops(filters);
  res.status(200).json({ success: true, data, message: "Stops fetched successfully" });
});

const getBuses = asyncHandler(async (req, res) => {
  const data = await transportService.getBuses(req.body.stop);
  res.status(200).json({ success: true, data, message: "Buses fetched successfully" });
});

const getFees = asyncHandler(async (req, res) => {
  const filters = { busNo: req.body.busNo, stop: req.body.stop };
  const data = await transportService.getFees(filters);
  res.status(200).json({ success: true, data, message: "Fees fetched successfully" });
});

const addTransport = asyncHandler(async (req, res) => {
  const data = await transportService.addTransport(req.body);
  res.status(201).json({ success: true, data, message: "Transport record added successfully" });
});

const bulkAddTransport = asyncHandler(async (req, res) => {
  const result = await transportService.bulkAddTransport(req.body.records);
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
      ? "All transport records created successfully"
      : `${result.created.length} created, ${result.failed.length} failed`
  });
});

const updateTransport = asyncHandler(async (req, res) => {
  const result = await transportService.updateTransport(req.params.id, req.body);
  res.status(200).json({
    success: true,
    data: { transport: result.transport, trackingRecordsUpdated: result.trackingRecordsUpdated },
    message: "Transport record updated successfully"
  });
});

module.exports = {
  getFullMapping,
  getStops,
  getBuses,
  getFees,
  addTransport,
  bulkAddTransport,
  updateTransport
};
