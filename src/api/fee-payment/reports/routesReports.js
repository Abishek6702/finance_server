const express = require("express");
const router = express.Router();
const controller = require("./controllerReports");
const {
  validateIndividualReportQuery,
  validateDatewiseReportQuery,
} = require("./validationReports");
const { protect, admin } = require("../../../middleware/authMiddleware");

// Ensure admin level access is required for reports
router.use(protect, admin);

router.get("/individual", validateIndividualReportQuery, controller.getIndividualReport);
router.get("/datewise", validateDatewiseReportQuery, controller.getDatewiseReport);

module.exports = router;
