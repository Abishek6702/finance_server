const multer = require("multer");
const feeStructureService = require("./service.acadamic");
const asyncHandler = require("../../../utils/asyncHandler");
const AppError = require("../../../utils/AppError");

/* ──────────────────────────────────────────────────────────
   Multer – memory storage (buffer passed directly to xlsx)
────────────────────────────────────────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ];
    const extOk = /\.(csv|xls|xlsx)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) return cb(null, true);
    cb(new AppError("Only CSV / Excel files are accepted", 400));
  },
}).single("file");

const runUpload = (req, res) =>
  new Promise((resolve, reject) =>
    upload(req, res, (err) => (err ? reject(err) : resolve()))
  );


const createFeeStructure = asyncHandler(async (req, res) => {
  const data = await feeStructureService.createFeeStructure(req.body);
  res.status(201).json({ success: true, data, message: "Fee structure created successfully" });
});

const getFeeStructures = asyncHandler(async (req, res) => {
  const data = await feeStructureService.getFeeStructures();
  res.status(200).json({ success: true, data, message: "Fee structures fetched successfully" });
});

const getFeeStructureByYear = asyncHandler(async (req, res) => {
  const data = await feeStructureService.getFeeStructureByYear(req.params.academicYear);
  res.status(200).json({ success: true, data, message: "Fee structure fetched successfully" });
});

const updateFeeStructure = asyncHandler(async (req, res) => {
  const result = await feeStructureService.updateFeeStructure(req.params.academicYear, req.body);
  res.status(200).json({
    success: true,
    data: { feeStructure: result.feeStructure, trackingRecordsUpdated: result.trackingRecordsUpdated },
    message: "Fee structure updated successfully"
  });
});

const deleteFeeStructure = asyncHandler(async (req, res) => {
  await feeStructureService.deleteFeeStructure(req.params.academicYear);
  res.status(200).json({ success: true, data: null, message: "Fee structure deleted successfully" });
});

/* ──────────────────────────────────────────────────────────
   POST /api/feeStructureMaster/bulk
   Accepts: multipart/form-data, field name "file" (CSV or Excel)
   Upserts one or many academicYear fee structures from the file.
   Returns 200 (no errors) or 207 Multi-Status (some row errors).
────────────────────────────────────────────────────────── */

const bulkUpsertFeeStructure = asyncHandler(async (req, res) => {
  await runUpload(req, res);

  if (!req.file) throw new AppError("No file uploaded – send a CSV or Excel file in the 'file' field", 400);

  const result = await feeStructureService.bulkUpsertFeeStructure(req.file.buffer);

  const status = result.rowErrors.length === 0 ? 200 : 207;
  res.status(status).json({
    success: result.rowErrors.length === 0,
    data: result,
    message: `Bulk upsert complete. Created: ${result.created.length}, Updated: ${result.updated.length}${result.rowErrors.length ? `, Errors: ${result.rowErrors.length}` : ""}`,
  });
});

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure,
  bulkUpsertFeeStructure,
};
