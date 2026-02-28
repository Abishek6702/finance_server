const feeStructureService = require("./service.feeStructure");

const createFeeStructure = async (req, res) => {
  try {
    const feeStructure = await feeStructureService.createFeeStructure(req.body);
    res.status(201).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getFeeStructures = async (req, res) => {
  try {
    const feeStructures = await feeStructureService.getFeeStructures();
    res.status(200).json({ success: true, data: feeStructures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFeeStructureByYear = async (req, res) => {
  try {
    const feeStructure = await feeStructureService.getFeeStructureByYear(req.params.academicYear);
    res.status(200).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const feeStructure = await feeStructureService.updateFeeStructure(req.params.academicYear, req.body);
    res.status(200).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteFeeStructure = async (req, res) => {
  try {
    await feeStructureService.deleteFeeStructure(req.params.academicYear);
    res.status(200).json({ success: true, message: "Fee structure deleted successfully" });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};


module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure, 
};
