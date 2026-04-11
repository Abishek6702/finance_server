const mongoose = require("mongoose");
const FeeStructureMaster = require("./modelAcadamic");
const AppError = require("../../../utils/appError");
const Student = require("../../student/students-management/modelStudent");
const {
  upsertTrackingRowsForStudent,
} = require("../../fee-payment/student-fee-tracking/serviceTrackingSyncInternal");

const filterActiveData = (feeStructure, filters = {}) => {
  if (!feeStructure || !feeStructure.isActive) return null;

  const doc = feeStructure.toObject ? feeStructure.toObject() : JSON.parse(JSON.stringify(feeStructure));

  if (doc.academicStructures) {
    doc.academicStructures = doc.academicStructures.filter((struct) => {
      if (!struct.isActive) return false;
      if (filters.quota && struct.quota !== filters.quota) return false;
      if (filters.educationType && struct.educationType !== filters.educationType) return false;
      if (filters.degreeProgram && struct.degreeProgram !== filters.degreeProgram) return false;
      return true;
    }).map((struct) => {
      if (struct.departments) {
        struct.departments = struct.departments.filter(d => d.isActive).map(d => {
          if (d.semesters) {
            d.semesters = d.semesters.filter(s => s.isActive);
          }
          return d;
        });
      }
      return struct;
    });
  }
  return doc;
};

const createFeeStructure = async (data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear: data.academicYear });
  if (existing) throw new AppError("Fee structure for this academic year already exists", 409);

  let feeStructure = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const createdDocs = await FeeStructureMaster.create([data], { session });
      feeStructure = createdDocs[0];

      const students = await Student.find({
        "academic.currentAcademicYear": data.academicYear,
        passedout: { $ne: true },
      }).session(session);

      for (const student of students) {
        await upsertTrackingRowsForStudent(student, {
          session,
          academicYears: [data.academicYear],
          replaceExisting: false,
        });
      }
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }

  return feeStructure;
};

const getFeeStructures = async (query = {}) => {
  const { page, limit, ...filters } = query;
  const data = await FeeStructureMaster.find().sort({ createdAt: -1 });
  return data.map(d => filterActiveData(d, filters)).filter(Boolean);
};

const getFeeStructureByYear = async (academicYear, query = {}) => {
  const feeStructure = await FeeStructureMaster.findOne({ academicYear });
  if (!feeStructure) throw new AppError("Fee structure not found", 404);
  const filtered = filterActiveData(feeStructure, query);
  if (!filtered) throw new AppError("Fee structure not found or inactive", 404);
  return filtered;
};


const updateFeeStructure = async (academicYear, data) => {
  const existing = await FeeStructureMaster.findOne({ academicYear });
  if (!existing) throw new AppError("Fee structure not found", 404);

  if (data.academicStructures && Array.isArray(data.academicStructures)) {
    for (const newStruct of data.academicStructures) {
      let existingStruct = existing.academicStructures.find(
        (a) =>
          a.quota === newStruct.quota &&
          a.educationType === newStruct.educationType &&
          a.degreeProgram === newStruct.degreeProgram
      );

      if (!existingStruct) {
        existing.academicStructures.push(newStruct);
        existingStruct = existing.academicStructures[existing.academicStructures.length - 1];
      } else {
        if (newStruct.isActive !== undefined) existingStruct.isActive = newStruct.isActive;

        if (newStruct.departments && Array.isArray(newStruct.departments)) {
          for (const newDept of newStruct.departments) {
            let existingDept = existingStruct.departments.find(
              (d) => d.departmentName === newDept.departmentName
            );

            if (!existingDept) {
              existingStruct.departments.push(newDept);
            } else {
              if (newDept.isActive !== undefined) existingDept.isActive = newDept.isActive;

              if (newDept.semesters && Array.isArray(newDept.semesters)) {
                for (const newSem of newDept.semesters) {
                  let existingSem = existingDept.semesters.find(
                    (s) => s.semesterNumber === newSem.semesterNumber
                  );

                  if (!existingSem) {
                    existingDept.semesters.push(newSem);
                  } else {
                    if (newSem.isActive !== undefined) existingSem.isActive = newSem.isActive;
                    
                    const feeComponents = ["tuition", "exam", "erp", "book", "lab"];
                    for (const comp of feeComponents) {
                      if (newSem[comp] !== undefined && newSem[comp].fee !== undefined) {
                        if (!existingSem[comp]) existingSem[comp] = { fee: 0 };
                        existingSem[comp].fee = newSem[comp].fee;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (data.isActive !== undefined) existing.isActive = data.isActive;

  // Mark structures modified and save to trigger Mongoose pre-validate total calculations
  existing.markModified('academicStructures');
  await existing.save();

  return { feeStructure: existing.toObject() };
};

const deleteFeeStructure = async (academicYear, query = {}) => {
  const { quota, educationType, degreeProgram } = query;

  if (degreeProgram && (!educationType || !quota)) {
    throw new AppError("To filter by degreeProgram, you must also provide educationType and quota.", 400);
  }
  if (educationType && !quota) {
    throw new AppError("To filter by educationType, you must also provide a quota.", 400);
  }

  const existing = await FeeStructureMaster.findOne({ academicYear });
  if (!existing) throw new AppError("Fee structure not found", 404);

  if (!quota && !educationType && !degreeProgram) {
    existing.isActive = false;
  } else {
    let matchCount = 0;
    if (existing.academicStructures) {
      existing.academicStructures.forEach((struct) => {
        let match = true;
        if (quota && struct.quota !== quota) match = false;
        if (educationType && struct.educationType !== educationType) match = false;
        if (degreeProgram && struct.degreeProgram !== degreeProgram) match = false;

        if (match) {
          struct.isActive = false;
          matchCount++;
        }
      });
    }

    if (matchCount === 0) {
      throw new AppError("No matching academic structure found to delete", 404);
    }
  }

  existing.markModified("academicStructures");
  await existing.save();
  return { feeStructure: filterActiveData(existing) };
};

 

module.exports = {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureByYear,
  updateFeeStructure,
  deleteFeeStructure, 
};
