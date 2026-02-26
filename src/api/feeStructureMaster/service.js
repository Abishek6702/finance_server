const FeeStructureMaster = require("../../models/FeeStructureMaster");
 
const createFeeStructure = async (data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear: data.academicYear });
  if (existing) throw new Error("Fee structure for this academic year already exists");
  const feeStructure = await FeeStructureMaster.create(data);
  
 
  return feeStructure;
};

const getFeeStructures = async () => {
  return await FeeStructureMaster.find().sort({ createdAt: -1 });
};

const getFeeStructureByYear = async (academicYear) => {
  const feeStructure = await FeeStructureMaster.findOne({ academicYear });
  if (!feeStructure) throw new Error("Fee structure not found");
  return feeStructure;
};

const updateFeeStructure = async (academicYear, data) => {
  const updated = await FeeStructureMaster.findOneAndUpdate({ academicYear }, data, { new: true, runValidators: true });
  if (!updated) throw new Error("Fee structure not found"); 
  return updated;
};

const deleteFeeStructure = async (academicYear) => {
  const deleted = await FeeStructureMaster.findOneAndDelete({ academicYear });
  if (!deleted) throw new Error("Fee structure not found");
  return deleted;
};

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure
};
