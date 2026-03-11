const express = require("express");
const router = express.Router(); 
const controller = require("./controllerStudents");
const { createStudentValidation, updateStudentValidation, getStudentsValidation, searchStudentsValidation } = require("./validationStudents");
const { protect, superadmin, admin } = require("../../middleware/authMiddleware");
 
router.use(protect);

router.get("/search", admin, searchStudentsValidation, controller.searchStudents);

router.get("/", admin, getStudentsValidation, controller.getStudents);

router.get("/basic", admin, getStudentsValidation, controller.getBasicStudents);


router.post("/", superadmin, createStudentValidation, controller.createStudent);

// Bulk import routes (must come before /:rollNo to avoid param conflict)
router.post("/bulk", superadmin, controller.bulkCreateStudents);
router.put("/bulk", superadmin, controller.bulkUpdateStudents);


router.put("/:rollNo", superadmin, updateStudentValidation, controller.updateStudent);
router.delete("/:rollNo", superadmin, controller.deleteStudent);

module.exports = router;
