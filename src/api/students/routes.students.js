const express = require("express");
const router = express.Router(); 
const controller = require("./controller.students");
const { createStudentValidation, updateStudentValidation } = require("./validation.students");
const { protect, superadmin } = require("../../middleware/authMiddleware");
 
router.use(protect, superadmin);

router.post("/", createStudentValidation, controller.createStudent); 
router.get("/", controller.getStudents);
router.get("/:rollNo", controller.getStudentByRollNo);
router.put("/:rollNo", updateStudentValidation, controller.updateStudent);
router.delete("/:rollNo", controller.deleteStudent);

module.exports = router;
