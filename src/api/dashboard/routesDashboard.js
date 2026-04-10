const express = require("express");
const router = express.Router();

const controller = require("./controllerDashboard");
const {
  validateStudentsCountQuery,
  validateDepartmentDistributionQuery,
  validateFeesStatusQuery,
} = require("./validationDashboard");
const { protect, admin } = require("../../middleware/authMiddleware");

router.use(protect, admin);

router.get("/students-count", validateStudentsCountQuery, controller.getStudentsCount);
router.get(
  "/department-distribution",
  validateDepartmentDistributionQuery,
  controller.getDepartmentDistribution
);
router.get("/fees-status", validateFeesStatusQuery, controller.getFeesStatus);

module.exports = router;
