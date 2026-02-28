const Student=require("../students/model.student");
const { Transport }=require("../transport/model.transport");
const { Hostel }=require("../hostel/model.hostel");
const StudentFeeTracking=require("../studentFeeTracking/model.studentFeeTracking");
const generateLedger = require("./utils.students").generateLedger;
const mongoose=require("mongoose");
const AppError=require("../../utils/AppError");

const isTransactionUnsupported=(error)=>{
  const message=String(error?.message||"").toLowerCase();
  return message.includes("replica set member")||message.includes("mongos");
};

const flattenObject=(value,prefix="")=>{
  const flattened={};

  if(!value||typeof value!=="object"||Array.isArray(value)) return flattened;

  Object.entries(value).forEach(([key,entryValue])=>{
    if(typeof entryValue==="undefined") return;

    const nextPath=prefix?`${prefix}.${key}`:key;
    const isPlainObject=entryValue&&typeof entryValue==="object"&&!Array.isArray(entryValue)&&!(entryValue instanceof Date);

    if(isPlainObject){
      Object.assign(flattened,flattenObject(entryValue,nextPath));
    }else{
      flattened[nextPath]=entryValue;
    }
  });

  return flattened;
};

const mapTransport=async(data,session=null)=>{
  if(data.transport?.isApplicable && data.transport.route && data.transport.stopName){
    const query=Transport.findOne({
      route:data.transport.route,
      stop:data.transport.stopName
    });

    if(session) query.session(session);

    const transportDoc=await query;

    if(!transportDoc) throw new AppError("Transport route/stop not found",404);

    data.transport={
      isApplicable:true,
      transport:transportDoc._id
    };
  }
};

const mapHostel=async(data,session=null)=>{
  if(data.hostel?.isApplicable && data.hostel.block && data.hostel.sharing && data.hostel.isAttached !== undefined){
    const query=Hostel.findOne({
      block:data.hostel.block,
      sharing:data.hostel.sharing,
      isAttached:data.hostel.isAttached
    });

    if(session) query.session(session);

    const hostelDoc=await query;

    if(!hostelDoc) throw new AppError("Hostel block/sharing/attached not found",404);

    data.hostel={
      isApplicable:true,
      hostel:hostelDoc._id
    };
  }
};

const createStudentWithoutTransaction=async(data)=>{
  const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo});
  if(existing) throw new AppError("Student already exists",409);

  await mapTransport(data);
  await mapHostel(data);

  const student=await Student.create(data);

  const populatedStudent=await Student.findById(student._id)
    .populate("transport.transport")
    .populate("hostel.hostel");

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
      if(existing) throw new AppError("Student already exists",409);

      await mapTransport(data,session);
      await mapHostel(data,session);

      const students=await Student.create([data],{session});
      createdStudent=students[0];

      /* populate transport for ledger */
      const populatedStudent=await Student.findById(createdStudent._id)
        .session(session)
        .populate("transport.transport")
        .populate("hostel.hostel");

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
    .populate('hostel.hostel')
    .sort({ createdAt: -1 });
};

const getStudentByRollNo = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo })
    .populate('transport.transport')
    .populate('hostel.hostel');
  if (!student) throw new AppError("Student not found",404);
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
      throw new AppError(`Transport not found for route: ${data.transport.route}, stop: ${data.transport.stopName}`,404);
    }
    
    data.transport = {
      isApplicable: true,
      transport: transportDoc._id
    };
  }

  // Handle hostel data
  if(data.hostel?.isApplicable && data.hostel.block && data.hostel.sharing && data.hostel.isAttached !== undefined){
    const hostelDoc=await Hostel.findOne({
      block:data.hostel.block,
      sharing:data.hostel.sharing,
      isAttached:data.hostel.isAttached
    });

    if(!hostelDoc){
        throw new AppError(`Hostel not found for block: ${data.hostel.block}, sharing: ${data.hostel.sharing}, isAttached: ${data.hostel.isAttached}`,404);
    }

    data.hostel={
      isApplicable:true,
      hostel:hostelDoc._id
    };
  }
  
  const updatePayload = flattenObject(data);

  const updated = await Student.findOneAndUpdate(
    { "personal.rollNo": rollNo }, 
    { $set: updatePayload }, 
    { new: true, runValidators: true }
  ).populate('transport.transport').populate('hostel.hostel');
  
  if (!updated) throw new AppError("Student not found",404);
  return updated;
};

const deleteStudentByRollNo = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo })
    .populate('transport.transport')
    .populate('hostel.hostel');
  if (!student) throw new AppError("Student not found",404);
  
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

