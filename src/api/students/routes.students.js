const express = require("express");
const router = express.Router(); 
const controller = require("./controller.students");
const { createStudentValidation, updateStudentValidation } = require("./validation.students");
const { protect, superadmin,admin } = require("../../middleware/authMiddleware");
 
router.use(protect, );

router.post("/", superadmin,createStudentValidation, controller.createStudent);

// Bulk import routes (must come before /:rollNo to avoid param conflict)
router.post("/bulk",superadmin, controller.bulkCreateStudents);
router.put("/bulk",superadmin, controller.bulkUpdateStudents);

router.get("/",admin, controller.getStudents);
router.get("/:rollNo",admin, controller.getStudentByRollNo);
router.put("/:rollNo", superadmin, updateStudentValidation, controller.updateStudent);
router.delete("/:rollNo", superadmin, controller.deleteStudent);

module.exports = router;
