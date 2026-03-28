const express = require("express");
const router = express.Router();
const controller = require("./controllerReports");
const {
  validateIndividualReportQuery,
  validateDatewiseReportQuery,
  validateClasswiseReportQuery,
  validateCumulativeBalanceHistoryQuery,
} = require("./validationReports");
const { protect, admin } = require("../../../middleware/authMiddleware");

// Ensure admin level access is required for reports
router.use(protect, admin);

router.get("/individual", validateIndividualReportQuery, controller.getIndividualReport);
router.get("/datewise", validateDatewiseReportQuery, controller.getDatewiseReport);
router.get("/classwise", validateClasswiseReportQuery, controller.getClasswiseReport);
router.get("/classwise/pdf", validateCumulativeBalanceHistoryQuery, controller.getCumulativeBalanceHistoryReport);

module.exports = router;
