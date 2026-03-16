const Student=require("./modelStudent");
const { Transport }=require("../../fee-structure/transport/modelTransport");
const { Hostel }=require("../../fee-structure/hostel/modelHostel");
const StudentFeeTracking=require("../../fee-payment/student-fee-tracking/modelStudentFeeTracking");
const generateLedger = require("./utilsStudents").generateLedger;
const { validateStudentPayload } = require("./validationStudents");
const mongoose=require("mongoose");
const AppError=require("../../../utils/appError");

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
      transport:transportDoc.id,
      route:transportDoc.route,
      busNo:transportDoc.busNo,
      stop:transportDoc.stop,
      fee:transportDoc.fee
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
      hostel:hostelDoc.id,
      block:hostelDoc.block,
      sharing:hostelDoc.sharing,
      isAttached:hostelDoc.isAttached,
      fee:hostelDoc.fee
    };
  }
};

const createStudentWithoutTransaction=async(data)=>{
  const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo});
  if(existing) throw new AppError("Student already exists",409);

  await mapTransport(data);
  await mapHostel(data);

  const student=await Student.create(data);

  await generateLedger(student);
  return student;
};
 
const createStudent=async(data)=>{
  const session=await mongoose.startSession();
  let createdStudent=null;
  let sessionEnded=false;
  let traking=null;
  try{
    await session.withTransaction(async()=>{

      const existing=await Student.findOne({"personal.rollNo":data.personal?.rollNo}).session(session);
      if(existing) throw new AppError("Student already exists",409);

      await mapTransport(data,session);
      await mapHostel(data,session);

      const students=await Student.create([data],{session});
      createdStudent=students[0];

     traking = await generateLedger(createdStudent,{session}); 

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

const VALID_STUDENT_FIELDS = ["personal", "academic", "contact", "family", "address", "enrollment", "transport", "hostel"];

const getStudents = async ({ rollNo, fields } = {}) => {
  const projection = fields && fields.length > 0
    ? fields.reduce((acc, f) => { acc[f] = 1; return acc; }, {})
    : null;

  if (rollNo) {
    const query = Student.findOne({ "personal.rollNo": rollNo });
    if (projection) query.select(projection);
    const student = await query;
    if (!student) throw new AppError("Student not found", 404);
    return student;
  }

  const query = Student.find().sort({ createdAt: -1 });
  if (projection) query.select(projection);
  return await query;
};


const getBasicStudents = async ({ academicYear, department, yearStudying, search }) => {
  
  const query = {};

  if (academicYear) query["academic.currentAcademicYear"] = academicYear;
  if (department) query["academic.departmentName"] = department;
  if (yearStudying) query["academic.yearStudying"] = Number(yearStudying);

  if (search) {
    query["$or"] = [
      { "personal.rollNo": { $regex: search, $options: "i" } },
      { "personal.studentName": { $regex: search, $options: "i" } }
    ];
  }

  const students = await Student.find(query)
    .select({
      "personal.studentName": 1,
      "personal.rollNo": 1,
      "personal.studentPhoto": 1,
      "academic.departmentName": 1,
      "academic.yearStudying": 1,
      "academic.section": 1,
      "academic.currentAcademicYear": 1
    })
    .sort({ createdAt: -1 })
    .lean();

  return students.map(student => ({
    _id: student._id,
    name: student.personal?.studentName || "",
    rollNo: student.personal?.rollNo || "",
    profile: student.personal?.studentPhoto || "",
    department: student.academic?.departmentName || "",
    currentYear: student.academic?.yearStudying || "",
    section: student.academic?.section || "",
    currentAcademicYear: student.academic?.currentAcademicYear || ""
  }));
};

const searchStudents = async (q) => {
  // Regex search on rollNo (starts-with query)
  // Maps results safely using optional chaining.
  const students = await Student.find({
    "personal.rollNo": { $regex: `^${q}`, $options: "i" }
  })
    .select({
      personal: 1,
      academic: 1,
      "enrollment.excessAmount": 1,
      "enrollment.isExcessAmountTrue": 1
    })
    .limit(20)
    .lean();

  return students.map(student => ({
    rollNo: student.personal?.rollNo || "",
    name: student.personal?.studentName || "",
    profile: student.personal?.studentPhoto || "",
    registerNumber: student.personal?.registerNumber || "",
    currentYear: student.academic?.yearStudying || "",
    section: student.academic?.section || "",
    department: student.academic?.departmentName || "",
    batch: student.academic?.batch || "",
    currentSemester: student.academic?.currentSemesterNumber || "",
    excess_amount: student.enrollment?.excessAmount || 0,
    is_excess_amount_true: Boolean(student.enrollment?.isExcessAmountTrue)
  }));
};

const updateStudent = async (rollNo, data) => {
  // Handle transport data - convert route/stopName to Transport ID + embed data
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
      transport: transportDoc.id,
      route: transportDoc.route,
      busNo: transportDoc.busNo,
      stop: transportDoc.stop,
      fee: transportDoc.fee
    };
  }

  // Handle hostel data - embed full data
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
      hostel:hostelDoc.id,
      block:hostelDoc.block,
      sharing:hostelDoc.sharing,
      isAttached:hostelDoc.isAttached,
      fee:hostelDoc.fee
    };
  }
  
  const updatePayload = flattenObject(data);

  const updated = await Student.findOneAndUpdate(
    { "personal.rollNo": rollNo }, 
    { $set: updatePayload }, 
    { new: true, runValidators: true }
  );
  
  if (!updated) throw new AppError("Student not found",404);

  await generateLedger(updated);

  return updated;
};

const deleteStudentByRollNo = async (rollNo) => {
  const student = await Student.findOne({ "personal.rollNo": rollNo });
  if (!student) throw new AppError("Student not found",404);
  
  // Clean up fee tracking too
  await StudentFeeTracking.findOneAndDelete({ student: student._id });
  
  await Student.findByIdAndDelete(student._id);
  return student;
};
 

/* -------------------------------------------------------
   BULK CREATE  – process each row independently so a single
   bad row does not abort the whole batch.
------------------------------------------------------- */
const bulkCreateStudents = async (rows) => {
  const created = [];
  const failed  = [];

  for (let i = 0; i < rows.length; i++) {
    const row      = rows[i];
    const rollNo   = row?.personal?.rollNo ?? `row-${i + 2}`; // +2 because header is row 1

    const validationErrors = validateStudentPayload(row, { partial: false });
    if (validationErrors.length) {
      failed.push({
        row:    i + 2,
        rollNo,
        reason: validationErrors.join("; "),
      });
      continue;
    }

    try {
      const student = await createStudent(row);
      created.push({ rollNo, id: student._id });
    } catch (err) {
      failed.push({
        row:    i + 2,            // 1-indexed, 1 = header
        rollNo,
        reason: err.message,
      });
    }
  }

  return { created, failed };
};

/* -------------------------------------------------------
   BULK UPDATE  – only updates fields present in the row,
   identified by personal.rollNo.
------------------------------------------------------- */
const bulkUpdateStudents = async (rows) => {
  const updated = [];
  const failed  = [];

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rollNo = row?.personal?.rollNo;

    if (!rollNo) {
      failed.push({ row: i + 2, rollNo: null, reason: "rollNo is required for update" });
      continue;
    }

    // Strip rollNo from the update payload (it's the lookup key, not a field to change)
    const { personal, ...rest } = row;
    const { rollNo: _omit, ...personalRest } = personal ?? {};
    const updatePayload = Object.keys(personalRest).length
      ? { personal: personalRest, ...rest }
      : rest;

    try {
      const student = await updateStudent(rollNo, updatePayload);
      updated.push({ rollNo, id: student._id });
    } catch (err) {
      failed.push({ row: i + 2, rollNo, reason: err.message });
    }
  }

  return { updated, failed };
};

module.exports = {
  createStudent,
  getStudents,
  searchStudents,
  updateStudent,
  deleteStudentByRollNo,
  bulkCreateStudents,
  bulkUpdateStudents,
  getBasicStudents,
};

