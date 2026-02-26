const express = require("express");
const router = express.Router();
const multer = require("multer");
const controller = require("./controller");
const { validateStudent } = require("./validation");
const { protect, superadmin } = require("../../middleware/authMiddleware");
 
router.use(protect, superadmin);

router.post("/", validateStudent, controller.createStudent); 
router.get("/", controller.getStudents);
router.get("/:rollNo", controller.getStudentByRollNo);
router.put("/:rollNo", validateStudent, controller.updateStudent);
router.delete("/:rollNo", controller.deleteStudent);

module.exports = router;
