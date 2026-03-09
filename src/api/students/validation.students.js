const AppError = require("../../utils/AppError");

const GENDERS = ["Male", "Female", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DEPARTMENTS = ["CSE", "IT", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL"];
const EDUCATION_TYPES = ["UG", "PG"];
const ACADEMIC_TYPES = ["REG", "PART_TIME"];
const DEGREE_PROGRAMS = ["BE", "BTech", "ME", "MTech"];
const SECTIONS = ["A", "B", "C", "D", "E", "F"];
const QUOTAS = ["Management Quota", "Government Quota"];
const HOSTEL_SHARING = [2, 3, 4, 5];

const isUndefined = (value) => typeof value === "undefined";
const isString = (value) => typeof value === "string";
const isNonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

const pushRequired = (errors, value, field) => {
  if (isUndefined(value) || value === null || value === "") {
    errors.push(`${field} is required`);
  }
};

const pushRegex = (errors, value, regex, message) => {
  if (!isUndefined(value) && value !== null && value !== "" && !regex.test(String(value))) {
    errors.push(message);
  }
};

const pushEnum = (errors, value, allowed, field) => {
  if (!isUndefined(value) && value !== null && !allowed.includes(value)) {
    errors.push(`${field} must be one of: ${allowed.join(", ")}`);
  }
};

const YEARLY_CONCESSION_FIELDS = [
  "yearlyLabConcessionAmount",
  "yearlyBookConcessionAmount",
  "yearlyErpConcessionAmount",
  "yearlyExamConcessionAmount",
  "yearlyTransportConcessionAmount",
  "yearlyHostelConcessionAmount",
  "yearlyTuitionConcessionAmount",
];

const validateConcession = (errors, obj, field) => {
  if (!obj || typeof obj !== "object") return;
  if (!isUndefined(obj.isApplicable) && typeof obj.isApplicable !== "boolean") {
    errors.push(`${field}.isApplicable must be a boolean`);
  }
  YEARLY_CONCESSION_FIELDS.forEach((f) => {
    if (!isUndefined(obj[f]) && !isNonNegativeNumber(obj[f])) {
      errors.push(`${field}.${f} must be a non-negative number`);
    }
  });
};

const validateStudentPayload = (payload, { partial = false } = {}) => {
  const errors = [];

  const personal = payload?.personal;
  const academic = payload?.academic;
  const contact = payload?.contact;
  const enrollment = payload?.enrollment;
  const transport = payload?.transport;
  const hostel = payload?.hostel;

  if (!partial) {
    pushRequired(errors, personal, "personal");
    pushRequired(errors, academic, "academic");
  }

  if (personal && typeof personal === "object") {
    if (!partial) {
      pushRequired(errors, personal.rollNo, "personal.rollNo");
    }
    pushRegex(errors, personal.rollNo, /^\d{2}[A-Z]{2}\d{3}$/, "personal.rollNo format is invalid (expected 12CS101)");
    pushEnum(errors, personal.gender, GENDERS, "personal.gender");
    pushEnum(errors, personal.bloodGroup, BLOOD_GROUPS, "personal.bloodGroup");
    pushRegex(errors, personal.aadharNo, /^\d{12}$/, "personal.aadharNo must be 12 digits");

    if (!isUndefined(personal.community) && isString(personal.community) && personal.community.length > 50) {
      errors.push("personal.community max length is 50");
    }
    if (!isUndefined(personal.casteName) && isString(personal.casteName) && personal.casteName.length > 50) {
      errors.push("personal.casteName max length is 50");
    }
  }

  if (academic && typeof academic === "object") {
    if (!partial) {
      pushRequired(errors, academic.degreeProgram, "academic.degreeProgram");
      pushRequired(errors, academic.batch, "academic.batch");
      pushRequired(errors, academic.currentAcademicYear, "academic.currentAcademicYear");
      pushRequired(errors, academic.departmentName, "academic.departmentName");
      pushRequired(errors, academic.yearStudying, "academic.yearStudying");
      pushRequired(errors, academic.currentSemesterNumber, "academic.currentSemesterNumber");
    }

    pushEnum(errors, academic.educationType, EDUCATION_TYPES, "academic.educationType");
    pushEnum(errors, academic.academicType, ACADEMIC_TYPES, "academic.academicType");
    pushEnum(errors, academic.departmentName, DEPARTMENTS, "academic.departmentName");
    pushEnum(errors, academic.degreeProgram, DEGREE_PROGRAMS, "academic.degreeProgram");
    pushEnum(errors, academic.section, SECTIONS, "academic.section");

    if (!isUndefined(academic.isLateralEntry) && typeof academic.isLateralEntry !== "boolean") {
      errors.push("academic.isLateralEntry must be a boolean");
    }

    if (!isUndefined(academic.yearStudying) && ![1, 2, 3, 4].includes(academic.yearStudying)) {
      errors.push("academic.yearStudying must be between 1 and 4");
    }
    if (!isUndefined(academic.currentSemesterNumber) && ![1, 2, 3, 4, 5, 6, 7, 8].includes(academic.currentSemesterNumber)) {
      errors.push("academic.currentSemesterNumber must be between 1 and 8");
    }

    pushRegex(errors, academic.batch, /^\d{4}-\d{4}$/, "academic.batch format is invalid (expected YYYY-YYYY)");
    pushRegex(errors, academic.currentAcademicYear, /^\d{4}-\d{4}$/, "academic.currentAcademicYear format is invalid (expected YYYY-YYYY)");

    const batchVal = academic.batch;
    const currentAcademicYearVal = academic.currentAcademicYear;
    const currentSemVal = academic.currentSemesterNumber;
    if (batchVal && currentAcademicYearVal && !isUndefined(currentSemVal)) {
      const batchStartYear = parseInt(String(batchVal).split("-")[0], 10);
      const currentStartYear = parseInt(String(currentAcademicYearVal).split("-")[0], 10);
      if (!isNaN(batchStartYear) && !isNaN(currentStartYear)) {
        const studyYear = currentStartYear - batchStartYear + 1;
        if (studyYear < 1 || studyYear > 4) {
          errors.push(`academic.batch and academic.currentAcademicYear are inconsistent (derived study year ${studyYear} is outside valid range 1–4)`);
        } else {
          const expectedOdd  = studyYear * 2 - 1;
          const expectedEven = studyYear * 2;
          if (![expectedOdd, expectedEven].includes(currentSemVal)) {
            errors.push(`academic.currentSemesterNumber must be ${expectedOdd} or ${expectedEven} for batch ${batchVal} in academicYear ${currentAcademicYearVal} (study year ${studyYear})`);
          }
        }
      }
    }
  }

  if (contact && typeof contact === "object") {
    pushRegex(errors, contact.selfMobileNo, /^[6-9]\d{9}$/, "contact.selfMobileNo must be a valid 10-digit Indian number");
    pushRegex(errors, contact.selfEmail, /^\S+@\S+\.\S+$/, "contact.selfEmail is invalid");
    pushRegex(errors, contact.officialEmail, /^[a-z0-9._%+-]+@sece\.ac\.in$/, "contact.officialEmail must be a valid @sece.ac.in email");
  }

  if (enrollment && typeof enrollment === "object") {
    if (!partial) {
      pushRequired(errors, enrollment.quota, "enrollment.quota");
    }
    pushEnum(errors, enrollment.quota, QUOTAS, "enrollment.quota");

    validateConcession(errors, enrollment.firstGraduate, "enrollment.firstGraduate");
    validateConcession(errors, enrollment.govtSchoolScheme, "enrollment.govtSchoolScheme");
    validateConcession(errors, enrollment.pmssScheme, "enrollment.pmssScheme");
    validateConcession(errors, enrollment.sakthiScheme, "enrollment.sakthiScheme");
    validateConcession(errors, enrollment.specialConcession, "enrollment.specialConcession");
  }

  if (transport && typeof transport === "object") {
    if (!isUndefined(transport.isApplicable) && typeof transport.isApplicable !== "boolean") {
      errors.push("transport.isApplicable must be a boolean");
    }
  }

  if (hostel && typeof hostel === "object") {
    if (!isUndefined(hostel.isApplicable) && typeof hostel.isApplicable !== "boolean") {
      errors.push("hostel.isApplicable must be a boolean");
    }
    if (!isUndefined(hostel.block) && !isString(hostel.block)) {
      errors.push("hostel.block must be a string");
    }
    if (hostel.roomType && typeof hostel.roomType === "object") {
      pushEnum(errors, hostel.roomType.sharingType, HOSTEL_SHARING, "hostel.roomType.sharingType");
      if (!isUndefined(hostel.roomType.isAttached) && typeof hostel.roomType.isAttached !== "boolean") {
        errors.push("hostel.roomType.isAttached must be a boolean");
      }
    }
  }

  return errors;
};

const createStudentValidation = (req, res, next) => {
  const errors = validateStudentPayload(req.body, { partial: false });
  if (errors.length) {
    return next(new AppError(errors.join("; "), 400));
  }
  next();
};

const updateStudentValidation = (req, res, next) => {
  const errors = validateStudentPayload(req.body, { partial: true });
  if (errors.length) {
    return next(new AppError(errors.join("; "), 400));
  }
  next();
};

module.exports = {
  validateStudentPayload,
  createStudentValidation,
  updateStudentValidation
};
