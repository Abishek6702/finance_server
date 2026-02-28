const studentService = require("./service.students");

const createStudent = async (req, res) => {
  const student = await studentService.createStudent(req.body);
  res.status(201).json({ success: true, data: student });
};

const getStudents = async (req, res) => {
  const students = await studentService.getStudents();
  res.status(200).json({ success: true, data: students });
};

const getStudentByRollNo = async (req, res) => {
  const student = await studentService.getStudentByRollNo(req.params.rollNo);
  res.status(200).json({ success: true, data: student });
};

const updateStudent = async (req, res) => {
  const student = await studentService.updateStudent(req.params.rollNo, req.body);
  res.status(200).json({ success: true, data: student });
};

const deleteStudent = async (req, res) => {
  await studentService.deleteStudentByRollNo(req.params.rollNo);
  res.status(200).json({ success: true, message: "Student and fee tracking deleted successfully" });
};
 

module.exports = {
  createStudent,
  getStudents,
  getStudentByRollNo,
  updateStudent,
  deleteStudent, 
};
