 const express = require("express");
const router = express.Router();
const controller = require("./controllerFeeDemand");
const {
  validateGetList,
  validateGetByRollNo,
  validateGetBySemester,
} = require("./validationFeeDemand");
const { protect, admin } = require("../../../middleware/authMiddleware");

router.use(protect, admin);

router.get("/", validateGetList, controller.getFeeDemandList);
router.get("/:rollNo/:academicYear", validateGetBySemester, controller.getFeeDemandBySemester);
router.get("/:rollNo", validateGetByRollNo, controller.getFeeDemandByRollNo);

module.exports = router;
