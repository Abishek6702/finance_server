const studentService = require("./service");

const createStudent = async (req, res) => {
  try {
    const student = await studentService.createStudent(req.body);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await studentService.getStudents();
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStudentByRollNo = async (req, res) => {
  try {
    const student = await studentService.getStudentByRollNo(req.params.rollNo);
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const student = await studentService.updateStudent(req.params.rollNo, req.body);
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    await studentService.deleteStudentByRollNo(req.params.rollNo);
    res.status(200).json({ success: true, message: "Student and fee tracking deleted successfully" });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};
 

module.exports = {
  createStudent,
  getStudents,
  getStudentByRollNo,
  updateStudent,
  deleteStudent, 
};
