# Students Management API Documentation

## Overview

The Students Management module handles student lifecycle operations:

- create single student
- read students
- search students
- update student
- delete student
- bulk create and bulk update from CSV or Excel

Base route:

- /api/studentsManagement

Access control:

- All routes require authentication.
- GET and search routes: admin role.
- create, update, delete, bulk routes: superadmin role.

Core side effects:

- Student creation generates and updates student fee tracking ledger.
- If transport or hostel is applicable, route and block mappings are resolved against master collections.

## Query and Payload Validation

Validation middleware source: validationStudents.js

### Key enums

- Gender: Male, Female, Other
- Blood group: A+, A-, B+, B-, AB+, AB-, O+, O-
- Department: CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL
- Education type: UG, PG
- Academic type: REG, PART_TIME
- Degree program: BE, BTech, ME, MTech
- Section: A, B, C, D, E, F
- Quota: Management Quota, Government Quota
- Hostel sharing: 2, 3, 4, 5

### Important format rules

- personal.rollNo: must match DDLLNNN pattern, example 12CS101
- personal.aadharNo: exactly 12 digits
- academic.batch: YYYY-YYYY
- academic.currentAcademicYear: YYYY-YYYY
- contact.selfMobileNo: Indian 10-digit number starting with 6-9
- contact.selfEmail: valid email
- contact.officialEmail: must end with @sece.ac.in

### Semester consistency rule

If batch, currentAcademicYear, and currentSemesterNumber are provided:

- studyYear = start(currentAcademicYear) - start(batch) + 1
- valid semester numbers are only:
  - odd = studyYear * 2 - 1
  - even = studyYear * 2

Example:

- batch: 2024-2028
- currentAcademicYear: 2025-2026
- studyYear: 2
- allowed currentSemesterNumber: 3 or 4

## Endpoints

### 1) Search Students

- Method: GET
- Path: /search
- Full route: /api/studentsManagement/search
- Auth: admin

Query params:

- q (required): non-empty string

Behavior:

- Prefix search on personal.rollNo, case-insensitive
- Returns up to 20 students with compact fields for UI search

Success response:

- Status: 200

{
  "success": true,
  "data": [
    {
      "rollNo": "24CS101",
      "name": "Student Name",
      "profile": "...",
      "registerNumber": "...",
      "currentYear": 2,
      "section": "A",
      "department": "CSE",
      "batch": "2024-2028",
      "currentSemester": 3,
      "excessAmount": 0,
      "isExcessAmountTrue": false
    }
  ],
  "message": "Students searched successfully"
}

Common errors:

- 400: Search query q is required

### 2) Get Students

- Method: GET
- Path: /
- Full route: /api/studentsManagement
- Auth: admin

Query params:

- rollNo (optional): fetch one student
- fields (optional): comma-separated top-level projections

Allowed fields values:

- personal, academic, contact, family, address, enrollment, transport, hostel

Behavior:

- Without rollNo: returns all students sorted newest first
- With rollNo: returns single student or 404
- With fields: projection applied on allowed fields

Success response:

- Status: 200

{
  "success": true,
  "data": ["...studentsOrSingleStudent"],
  "message": "Students fetched successfully"
}

Common errors:

- 400: rollNo format invalid
- 400: invalid fields list
- 404: student not found for rollNo

### 3) Get Basic Students

- Method: GET
- Path: /basic
- Full route: /api/studentsManagement/basic
- Auth: admin

Query params:

- academicYear (optional)
- department (optional)
- yearStudying (optional)
- search (optional, applied to rollNo and studentName)

Response fields per item:

- _id
- name
- rollNo
- profile
- department
- currentYear
- section
- currentAcademicYear

### 4) Create Student

- Method: POST
- Path: /
- Full route: /api/studentsManagement
- Auth: superadmin

Minimum required body blocks:

- personal
- academic

Within academic, required in create:

- degreeProgram
- batch
- currentAcademicYear
- departmentName
- yearStudying
- currentSemesterNumber

Within enrollment, required when enrollment object is sent:

- quota

Transport mapping behavior:

- if transport.isApplicable is true and route plus stopName are provided,
  transport is resolved from Transport master and embedded as:
  - transport id
  - route
  - busNo
  - stop
  - fee

Hostel mapping behavior:

- if hostel.isApplicable is true and block plus sharing plus isAttached are provided,
  hostel is resolved from Hostel master and embedded as:
  - hostel id
  - block
  - sharing
  - isAttached
  - fee

Success response:

- Status: 201

{
  "success": true,
  "data": { "...createdStudent" },
  "message": "Student created successfully"
}

Common errors:

- 400: validation failures
- 404: transport or hostel mapping not found
- 409: duplicate student rollNo

### 5) Update Student

- Method: PUT
- Path: /:rollNo
- Full route: /api/studentsManagement/:rollNo
- Auth: superadmin

Behavior:

- Partial updates supported.
- Nested payload is flattened into dot-notation for MongoDB $set updates.
- rollNo path param identifies the student.
- If transport or hostel applicable blocks are provided, master mapping is reapplied.
- After update, ledger regeneration is triggered.

Success response:

- Status: 200

{
  "success": true,
  "data": { "...updatedStudent" },
  "message": "Student updated successfully"
}

Common errors:

- 404: student not found
- 404: transport or hostel master mapping not found

### 6) Delete Student

- Method: DELETE
- Path: /:rollNo
- Full route: /api/studentsManagement/:rollNo
- Auth: superadmin

Behavior:

- Deletes student record by rollNo.
- Deletes corresponding StudentFeeTracking record.

Success response:

- Status: 200

{
  "success": true,
  "data": null,
  "message": "Student and fee tracking deleted successfully"
}

### 7) Bulk Create Students

- Method: POST
- Path: /bulk
- Full route: /api/studentsManagement/bulk
- Auth: superadmin
- Content type: multipart/form-data

Form-data:

- file: required

Allowed file types:

- csv, xls, xlsx
- max size: 10 MB

Behavior:

- Each row is validated independently.
- One failing row does not fail the entire batch.
- Returns status 201 when all succeed.
- Returns status 207 when partial failures occur.

Response shape:

{
  "success": false,
  "data": {
    "summary": { "total": 50, "created": 47, "failed": 3 },
    "created": [{ "rollNo": "24CS101", "id": "..." }],
    "failed": [{ "row": 12, "rollNo": "24CS155", "reason": "..." }]
  },
  "message": "47 created, 3 failed"
}

### 8) Bulk Update Students

- Method: PUT
- Path: /bulk
- Full route: /api/studentsManagement/bulk
- Auth: superadmin
- Content type: multipart/form-data

Behavior:

- Row matching key is personal.rollNo.
- rollNo is used as lookup key and excluded from update mutation.
- Only supplied fields are updated per row.
- Returns status 200 for full success, 207 for partial updates.

Response shape:

{
  "success": false,
  "data": {
    "summary": { "total": 30, "updated": 28, "failed": 2 },
    "updated": [{ "rollNo": "24IT001", "id": "..." }],
    "failed": [{ "row": 8, "rollNo": "24IT099", "reason": "..." }]
  },
  "message": "28 updated, 2 failed"
}

## Concession Field Contract

For each applicable concession scheme object (firstGraduate, scheme7point5, pmssScheme, sakthiScheme, specialConcession), supported yearly fields are:

- yearlyLabConcessionAmount
- yearlyBookConcessionAmount
- yearlyErpConcessionAmount
- yearlyExamConcessionAmount
- yearlyTransportConcessionAmount
- yearlyHostelConcessionAmount
- yearlyTuitionConcessionAmount

All concession values must be non-negative numbers.

## Role Matrix

- admin: search, get students, get basic students
- superadmin: create, update, delete, bulk create, bulk update

## Suggested Test Checklist

- create with valid payload
- create with mismatched semester and academicYear
- create with duplicate rollNo
- update partial nested fields
- delete existing and missing rollNo
- bulk create with mixed valid and invalid rows
- bulk update with missing rollNo rows
