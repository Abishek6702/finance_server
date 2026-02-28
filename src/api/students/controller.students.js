const studentService = require("./service.students");
const { parseStudentFile } = require("./utils.bulkParse");
const AppError = require("../../utils/AppError");
const asyncHandler = require("../../utils/asyncHandler");

const createStudent = asyncHandler(async (req, res) => {
  const data = await studentService.createStudent(req.body);
  res.status(201).json({ success: true, data, message: "Student created successfully" });
});

const getStudents = asyncHandler(async (req, res) => {
  const data = await studentService.getStudents();
  res.status(200).json({ success: true, data, message: "Students fetched successfully" });
});

const getStudentByRollNo = asyncHandler(async (req, res) => {
  const data = await studentService.getStudentByRollNo(req.params.rollNo);
  res.status(200).json({ success: true, data, message: "Student fetched successfully" });
});

const updateStudent = asyncHandler(async (req, res) => {
  const data = await studentService.updateStudent(req.params.rollNo, req.body);
  res.status(200).json({ success: true, data, message: "Student updated successfully" });
});

const deleteStudent = asyncHandler(async (req, res) => {
  await studentService.deleteStudentByRollNo(req.params.rollNo);
  res.status(200).json({ success: true, data: null, message: "Student and fee tracking deleted successfully" });
});

/* -------------------------------------------------------
   Multer – memory storage so we can pass the buffer to xlsx
------------------------------------------------------- */
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",   // some systems send xlsx with this
    ];
    const extOk = /\.(csv|xls|xlsx)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) return cb(null, true);
    cb(new AppError("Only CSV / Excel files are accepted", 400));
  },
}).single("file");

/** Promisify multer middleware so we can use async/await */
const runUpload = (req, res) =>
  new Promise((resolve, reject) =>
    upload(req, res, (err) => (err ? reject(err) : resolve()))
  );

/* -------------------------------------------------------
   POST /students/bulk  – create students from CSV / Excel
------------------------------------------------------- */
const bulkCreateStudents = asyncHandler(async (req, res) => {
  await runUpload(req, res);

  if (!req.file) throw new AppError("No file uploaded – send a CSV or Excel file in the 'file' field", 400);

  const rows = parseStudentFile(req.file.buffer, req.file.originalname);

  if (!rows.length) throw new AppError("The file is empty or contains no data rows", 400);

  const result = await studentService.bulkCreateStudents(rows);

  const status = result.failed.length === 0 ? 201 : 207; // 207 Multi-Status when some failed
  res.status(status).json({
    success: result.failed.length === 0,
    data: {
      summary: {
        total:   rows.length,
        created: result.created.length,
        failed:  result.failed.length,
      },
      created: result.created,
      failed:  result.failed,
    },
    message: result.failed.length === 0
      ? "All students created successfully"
      : `${result.created.length} created, ${result.failed.length} failed`
  });
});

/* -------------------------------------------------------
   PUT /students/bulk  – update students from CSV / Excel
   (matched by rollNo; only provided fields are updated)
------------------------------------------------------- */
const bulkUpdateStudents = asyncHandler(async (req, res) => {
  await runUpload(req, res);

  if (!req.file) throw new AppError("No file uploaded – send a CSV or Excel file in the 'file' field", 400);

  const rows = parseStudentFile(req.file.buffer, req.file.originalname);

  if (!rows.length) throw new AppError("The file is empty or contains no data rows", 400);

  const result = await studentService.bulkUpdateStudents(rows);

  const status = result.failed.length === 0 ? 200 : 207;
  res.status(status).json({
    success: result.failed.length === 0,
    data: {
      summary: {
        total:   rows.length,
        updated: result.updated.length,
        failed:  result.failed.length,
      },
      updated: result.updated,
      failed:  result.failed,
    },
    message: result.failed.length === 0
      ? "All students updated successfully"
      : `${result.updated.length} updated, ${result.failed.length} failed`
  });
});

module.exports = {
  createStudent,
  getStudents,
  getStudentByRollNo,
  updateStudent,
  deleteStudent,
  bulkCreateStudents,
  bulkUpdateStudents,
};
