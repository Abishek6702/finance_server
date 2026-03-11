const express = require("express");
const { protect, superadmin } = require("../../middleware/authMiddleware");
const { clearTables } = require("./controllerSuperadmin");

const router = express.Router();

router.delete("/clear-tables", protect, superadmin, clearTables);

module.exports = router;
