# Fee Structure Master API Documentation

## Overview

The Fee Structure Master module stores the canonical academic fee template for each academic year.

It is used by:

- Students Management: to initialize student yearly ledger rows when students are created.
- Student Fee Tracking: to append and propagate yearly fee demand rows.

Base route:

- /api/feeStructureMaster

Access control:

- All endpoints are protected.
- All endpoints require superadmin role.

Files in this module:

- routesAcadamic.js
- controllerAcadamic.js
- serviceAcadamic.js
- validationAcadamic.js
- modelAcadamic.js

## Data Model Summary

Top-level model: FeeStructureMaster

- academicYear: string, unique, format YYYY-YYYY
- academicStructures: array
- total.fee: computed
- isActive: boolean

Each academic structure contains:

- quota: Management Quota or Government Quota
- educationType: UG or PG
- degreeProgram: BE, BTech, ME, MTech
- departments: array

Each department contains:

- departmentName: CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL
- semesters: exactly 8 entries

Each semester contains:

- semesterNumber: 1 to 8
- tuition.fee, exam.fee, erp.fee, book.fee, lab.fee
- total.fee: computed
- isActive

Automatic total computation is handled in Mongoose pre-validate hooks at semester, department, academic structure, and master level.

## Validation Rules

Request validation middleware: validateFeeStructure

- academicYear is required and must match YYYY-YYYY.
- academicStructures, if provided, must be an array.
- structure.quota must be one of:
  - Management Quota
  - Government Quota
- structure.educationType must be one of:
  - UG
  - PG
- structure.degreeProgram must be one of:
  - BE
  - BTech
  - ME
  - MTech
- structure.departments must be an array.
- departmentName must be one of:
  - CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL
- each department must contain exactly 8 semesters.

## Endpoints

### 1) Create Fee Structure

- Method: POST
- Path: /
- Full route: /api/feeStructureMaster
- Auth: superadmin

Purpose:

- Creates a new fee structure for an academic year.
- Rejects if the academic year already exists.
- Appends current-year tracking rows for eligible students.

Request body example:

{
  "academicYear": "2026-2027",
  "academicStructures": [
    {
      "quota": "Government Quota",
      "educationType": "UG",
      "degreeProgram": "BE",
      "departments": [
        {
          "departmentName": "CSE",
          "semesters": [
            { "semesterNumber": 1, "tuition": { "fee": 55000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 2, "tuition": { "fee": 55000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 3, "tuition": { "fee": 57000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 4, "tuition": { "fee": 57000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 5, "tuition": { "fee": 59000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 6, "tuition": { "fee": 59000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 7, "tuition": { "fee": 62000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } },
            { "semesterNumber": 8, "tuition": { "fee": 62000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 1200 } }
          ]
        }
      ]
    }
  ]
}

Success response:

- Status: 201
- Body shape:

{
  "success": true,
  "data": { "...feeStructureDocument" },
  "message": "Fee structure created successfully"
}

Common errors:

- 400: invalid payload
- 409: academic year already exists

### 2) Get All Fee Structures

- Method: GET
- Path: /
- Full route: /api/feeStructureMaster
- Auth: superadmin

Success response:

- Status: 200

{
  "success": true,
  "data": ["...feeStructureDocuments"],
  "message": "Fee structures fetched successfully"
}

### 3) Get Fee Structure by Academic Year

- Method: GET
- Path: /:academicYear
- Full route: /api/feeStructureMaster/:academicYear
- Auth: superadmin

Success response:

- Status: 200

{
  "success": true,
  "data": { "...feeStructureDocument" },
  "message": "Fee structure fetched successfully"
}

Common errors:

- 404: fee structure not found

### 4) Update Fee Structure by Academic Year

- Method: PUT
- Path: /:academicYear
- Full route: /api/feeStructureMaster/:academicYear
- Auth: superadmin

Behavior:

- Partial merge update for nested academicStructures, departments, and semesters.
- Existing items are matched by:
  - structure: quota + educationType + degreeProgram
  - department: departmentName
  - semester: semesterNumber
- Newly missing nested items are appended.
- If isActive is sent at any level, it is updated.
- Updating fee structure does not mutate existing student fee tracking rows.

Success response:

- Status: 200

{
  "success": true,
  "data": {
    "feeStructure": { "...updatedDocument" }
  },
  "message": "Fee structure updated successfully"
}

Common errors:

- 400: invalid payload
- 404: fee structure not found

### 5) Delete Fee Structure by Academic Year

- Method: DELETE
- Path: /:academicYear
- Full route: /api/feeStructureMaster/:academicYear
- Auth: superadmin

Success response:

- Status: 200

{
  "success": true,
  "data": null,
  "message": "Fee structure deleted successfully"
}

Common errors:

- 404: fee structure not found

## Internal Side Effects and Integration Notes

### On create

When a new fee structure is created:

- Students with academic.currentAcademicYear equal to the created academicYear are checked.
- For each eligible student, one tracking row is built and appended only if it does not already exist.
- This operation is append-only and idempotent for existing rows.

### On update

When a fee structure is updated:

- Existing StudentFeeTracking rows are not modified.
- Changes affect only FeeStructureMaster data and future ledger creation/backfill workflows.

## Status and Total Semantics

For tracking records that consume this structure:

- subTotal means gross amount before concessions.
- total.total means net payable amount after concessions.
- paid is capped at total.total.
- status values are Paid, Partial, Unpaid, or Refunded (facility cancellation cases).

## Security

- Endpoints require protect middleware and superadmin role.
- Use Authorization header with Bearer token.

## Suggested Test Checklist

- Create valid structure with full 8 semesters.
- Reject invalid academicYear format.
- Reject non-array departments or academicStructures.
- Reject invalid enum values.
- Update one semester component and verify tracking propagation.
- Delete existing and non-existing academic year.
