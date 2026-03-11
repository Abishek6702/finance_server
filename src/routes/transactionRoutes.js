const express = require("express");
const router = express.Router();
console.log("Transaction routes loaded");
const { protect } = require("../middleware/authMiddleware");
const { dateWiseTransaction } = require("../controllers/transactionController");

router.use(protect);

router.get("/datewisetransaction", dateWiseTransaction);

module.exports = router;