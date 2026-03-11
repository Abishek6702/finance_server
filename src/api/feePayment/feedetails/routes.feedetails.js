const express = require("express");
const router = express.Router();
const controller = require("./controller.feedetails");
const {
  validateGetList,
  validateGetByRollNo,
  validateGetBySemester,
} = require("./validation.feedetails");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.use(protect, admin);

router.get("/", validateGetList, controller.getFeeDetailsList);
router.get("/:rollNo/:academicYear", validateGetBySemester, controller.getFeeDetailsBySemester);
router.get("/:rollNo", validateGetByRollNo, controller.getFeeDetailsByRollNo);

module.exports = router;
