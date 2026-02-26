const Student=require("../../models/Student");
const Transport=require("../../models/Transport");
const StudentFeeTracking=require("../../models/StudentFeeTracking");
const generateLedger = require("./utils").generateLedger;
 
const createStudent=async(data)=>{

  const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo});
  if(existing) throw new Error("Student already exists");

  /* Transport mapping */
  if(data.transport?.isApplicable && data.transport.route && data.transport.stopName){
    const transportDoc=await Transport.findOne({
      route:data.transport.route,
      stop:data.transport.stopName
    });

    if(!transportDoc) throw new Error("Transport route/stop not found");

    data.transport={
      isApplicable:true,
      transport:transportDoc._id
    };
  }

  const student=await Student.create(data);

  /* populate transport for ledger */
  const populatedStudent=await Student.findById(student._id)
    .populate("transport.transport");

  await generateLedger(populatedStudent);

  return student;
};

const getStudents = async () => {
  return await Student.find()
    .populate('transport.transport')
    .sort({ createdAt: -1 });
};

const getStudentByRollNo = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo })
    .populate('transport.transport');
  if (!student) throw new Error("Student not found");
  return student;
};

const updateStudent = async (rollNo, data) => {
  // Handle transport data - convert route/stopName to Transport ID
  if (data.transport?.isApplicable && data.transport.route && data.transport.stopName) {
    const transportDoc = await Transport.findOne({
      route: data.transport.route,
      stop: data.transport.stopName
    });
    
    if (!transportDoc) {
      throw new Error(`Transport not found for route: ${data.transport.route}, stop: ${data.transport.stopName}`);
    }
    
    data.transport = {
      isApplicable: true,
      transport: transportDoc._id
    };
  }
  
  const updated = await Student.findOneAndUpdate(
    { "personal.rollNo": rollNo }, 
    data, 
    { new: true, runValidators: true }
  ).populate('transport.transport');
  
  if (!updated) throw new Error("Student not found");
  return updated;
};

const deleteStudentByRollNo = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo })
    .populate('transport.transport');
  if (!student) throw new Error("Student not found");
  
  // Clean up fee tracking too
  await StudentFeeTracking.findOneAndDelete({ student: student._id });
  
  await Student.findByIdAndDelete(student._id);
  return student;
};
 

module.exports = {
  createStudent,
  getStudents,
  getStudentByRollNo,
  updateStudent,
  deleteStudentByRollNo, 
};
