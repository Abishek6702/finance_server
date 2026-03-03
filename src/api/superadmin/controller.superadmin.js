const mongoose = require("mongoose");

const clearTables = async (req, res) => {
  try {
    const tablenameRaw = req.query.tablename;
    const collections = mongoose.connection.collections;

    if (!tablenameRaw) {
      return res.status(400).json({ 
        message: "Please provide tablename in query params, e.g., ?tablename=true to clear all, or ?tablename=users,students to clear specific ones" 
      });
    }

    if (tablenameRaw === "true" || tablenameRaw === "all") {
      // Clear all
      let clearedCount = 0;
      for (const key in collections) {
        await collections[key].deleteMany({});
        clearedCount++;
      }
      return res.status(200).json({ message: `Successfully cleared all ${clearedCount} tables` });
    } else {
      // Clear specific tables
      const tablesToClear = tablenameRaw.split(",").map(t => t.trim());
      const cleared = [];
      const notFound = [];

      for (const tableName of tablesToClear) {
        if (collections[tableName]) {
          await collections[tableName].deleteMany({});
          cleared.push(tableName);
        } else {
          notFound.push(tableName);
        }
      }

      return res.status(200).json({ 
        message: "Table clearing operation completed", 
        cleared, 
        notFound 
      });
    }
  } catch (error) {
    console.error("Error clearing tables:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { clearTables };
