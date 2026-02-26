const Student=require("../../models/Student");
const Transport=require("../../models/Transport");
const StudentFeeTracking=require("../../models/StudentFeeTracking");
const generateLedger = require("./utils").generateLedger;
const mongoose=require("mongoose");

const isTransactionUnsupported=(error)=>{
  const message=String(error?.message||"").toLowerCase();
  return message.includes("replica set member")||message.includes("mongos");
};

const mapTransport=async(data,session=null)=>{
  if(data.transport?.isApplicable && data.transport.route && data.transport.stopName){
    const query=Transport.findOne({
      route:data.transport.route,
      stop:data.transport.stopName
    });

    if(session) query.session(session);

    const transportDoc=await query;

    if(!transportDoc) throw new Error("Transport route/stop not found");

    data.transport={
      isApplicable:true,
      transport:transportDoc._id
    };
  }
};

const createStudentWithoutTransaction=async(data)=>{
  const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo});
  if(existing) throw new Error("Student already exists");

  await mapTransport(data);

  const student=await Student.create(data);

  const populatedStudent=await Student.findById(student._id)
    .populate("transport.transport");

  await generateLedger(populatedStudent);
  return student;
};
 
const createStudent=async(data)=>{
  const session=await mongoose.startSession();
  let createdStudent=null;
  let sessionEnded=false;

  try{
    await session.withTransaction(async()=>{

      const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo}).session(session);
      if(existing) throw new Error("Student already exists");

      await mapTransport(data,session);

      const students=await Student.create([data],{session});
      createdStudent=students[0];

      /* populate transport for ledger */
      const populatedStudent=await Student.findById(createdStudent._id)
        .session(session)
        .populate("transport.transport");

      await generateLedger(populatedStudent,{session});
    });
  }catch(error){
    if(isTransactionUnsupported(error)){
      await session.endSession();
      sessionEnded=true;
      return await createStudentWithoutTransaction(data);
    }
    throw error;
  }finally{
    if(!sessionEnded && session.inTransaction()){
      await session.abortTransaction();
    }
    if(!sessionEnded){
      await session.endSession();
    }
  }

  return createdStudent;
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
