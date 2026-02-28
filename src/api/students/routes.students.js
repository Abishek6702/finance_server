const express = require("express");
const router = express.Router(); 
const controller = require("./controller.students");
const { createStudentValidation, updateStudentValidation } = require("./validation.students");
const { protect, superadmin } = require("../../middleware/authMiddleware");
 
router.use(protect, superadmin);

router.post("/", createStudentValidation, controller.createStudent);

// Bulk import routes (must come before /:rollNo to avoid param conflict)
router.post("/bulk", controller.bulkCreateStudents);
router.put("/bulk", controller.bulkUpdateStudents);

router.get("/", controller.getStudents);
router.get("/:rollNo", controller.getStudentByRollNo);
router.put("/:rollNo", updateStudentValidation, controller.updateStudent);
router.delete("/:rollNo", controller.deleteStudent);

module.exports = router;
