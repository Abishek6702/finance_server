const mongoose = require("mongoose");

// ---------- 1. PERSONAL ----------
const personalSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^\d{2}[A-Z]{2}\d{3}$/, "Invalid roll number format"]
  },
  studentName: { type: String, trim: true, minlength: 1, maxlength: 100 },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  dob: Date,
  bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
  aadharNo: { type: String, trim: true, match: [/^\d{12}$/, "Aadhar must be 12 digits"] },
  emisNo: { type: String, trim: true },
  religion: { type: String, trim: true, maxlength: 50 },
  nationality: { type: String, trim: true, maxlength: 50 },
  studentPhoto: { type: String, trim: true },
  hostelDayScholar: { type: String, enum: ["Hosteller", "Day Scholar"] },
  isCollegeTransport: { type: Boolean, default: false }
}, { _id: false });


// ---------- 2. ACADEMIC ----------
const academicSchema = new mongoose.Schema({
  educationType: { type: String, enum: ["UG", "PG"] },
  academicType: { type: String, enum: ["REG", "PART_TIME"] },
  isLateralEntry: { type: Boolean, default: false },
  department: { type: String, trim: true, maxlength: 100 },
  yearStudying: { type: Number, enum: [1, 2, 3, 4] },
  currentSem: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8] },
  section: { type: String, enum: ["A", "B", "C", "D", "E", "F"], uppercase: true, default: null },
  batch: {
    from: { type: Number, min: 1900, max: 2100 },
    to: { type: Number, min: 1900, max: 2100 }
  },
  currentAcademicYear: {
    from: { type: Number, min: 1900, max: 2100 },
    to: { type: Number, min: 1900, max: 2100 }
  }
}, { _id: false });


// ---------- 3. CONTACT ----------
const contactSchema = new mongoose.Schema({
  selfMobileNo: {
    type: String,
    trim: true,
    match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
  },
  selfEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
  },
  officialEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9._%+-]+@sece\.ac\.in$/, "Official email must end with @sece.ac.in"]
  }
}, { _id: false });


// ---------- 4. FAMILY ----------
const familySchema = new mongoose.Schema({
  father: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    },
    workType: { type: String, trim: true, maxlength: 50 },
    qualification: { type: String, trim: true, maxlength: 50 }
  },
  mother: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    },
    workType: { type: String, trim: true, maxlength: 50 },
    qualification: { type: String, trim: true, maxlength: 50 }
  },
  guardian: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    }
  },
  familyIncomeAsPerCertificate: { type: Number, min: 0 },
  community: { type: String, trim: true, maxlength: 50 },
  casteName: { type: String, trim: true, maxlength: 50 },
  communityCertificateNo: { type: String, trim: true, maxlength: 50 }
}, { _id: false });


// ---------- 5. ADDRESS ----------
const addressSchema = new mongoose.Schema({
  permanent: {
    doorNo: { type: String, trim: true, maxlength: 50 },
    street: { type: String, trim: true, maxlength: 100 },
    area: { type: String, trim: true, maxlength: 100 },
    villageOrTown: { type: String, trim: true, maxlength: 100 },
    taluk: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, "Pincode must be 6 digits"]
    }
  },
  communication: {
    doorNo: { type: String, trim: true, maxlength: 50 },
    street: { type: String, trim: true, maxlength: 100 },
    area: { type: String, trim: true, maxlength: 100 },
    villageOrTown: { type: String, trim: true, maxlength: 100 },
    taluk: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, "Pincode must be 6 digits"]
    }
  }
}, { _id: false });


// ---------- 6. ENROLLMENT ----------
const enrollmentSchema = new mongoose.Schema({
  quota: { type: String, enum: ["Management Quota", "Government Quota"] },
  isFirstGraduate: { type: Boolean, default: false },
  is7point5Scheme: { type: Boolean, default: false },
  isPMSSScheme: { type: Boolean, default: false },
  isSakthiScheme: { type: Boolean, default: false }
}, { _id: false });


// ---------- MAIN STUDENT SCHEMA ----------
const studentSchema = new mongoose.Schema({
  personal: personalSchema,
  academic: academicSchema,
  contact: contactSchema,
  family: familySchema,
  address: addressSchema,
  enrollment: enrollmentSchema
}, { timestamps: true });

module.exports = mongoose.model("Student", studentSchema);
