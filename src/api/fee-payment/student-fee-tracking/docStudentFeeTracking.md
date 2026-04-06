# Student Fee Tracking API Documentation

## Overview

The Student Fee Tracking module provides ledger-focused API responses that combine student profile data and year-wise fee tracking details.

Base route:

- /api/studentFeeTracking

Primary use cases:

- view tracking records by filters (batch, department, rollNo)
- use v2 response for frontend summary cards and academic-year detailed views
- run controlled backfill to append missing year rows

Access control:

- GET endpoints require admin role.
- backfill endpoint requires superadmin role.

## Ledger Semantics

Core schema model: StudentFeeTracking

- one document per student (unique student reference)
- academicYearWiseRecord array holds yearly rows
- each year row has:
  - academic block (odd and even semesters)
  - transport block (optional)
  - hostel block (optional)
  - concessions summary
  - subTotal and total

Important money semantics:

- subTotal = gross amount before concessions
- total.total = net payable amount after concessions
- total.paid is capped to total.total
- status is auto-computed as:
  - Paid
  - Partial
  - Unpaid
  - Refunded (facility inactive scenarios)

## Validation Rules

Query validator: validateGetQuery

- department must be one of:
  - CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL
- batch must match YYYY-YYYY
- rollNo must be alphanumeric

Backfill validator: validateBackfillRequest

- request body must be empty
- query params must be empty

## Endpoints

### 1) Get Student Fee Tracking Data

- Method: GET
- Path: /
- Full route: /api/studentFeeTracking
- Auth: admin

Query params:

- batch (optional): exact match on academic.batch
- department (optional): case-insensitive exact match on academic.departmentName
- rollNo (optional): exact uppercase match on personal.rollNo

Response behavior:

- returns list of student and feeTracking objects
- feeTracking excludes internal fields
- each academicYearWiseRecord row includes derived facility array with transport and hostel summaries
- if no students match, returns empty list with success true

Success response:

- Status: 200

{
  "success": true,
  "data": [
    {
      "student": {
        "personal": {
          "rollNo": "24CS101",
          "studentName": "Student A",
          "gender": "Male",
          "studentPhoto": "..."
        },
        "academic": { "...": "..." },
        "contact": { "...": "..." },
        "enrollment": { "...": "..." },
        "transport": { "...": "..." },
        "hostel": { "...": "..." }
      },
      "feeTracking": {
        "academicYearWiseRecord": [
          {
            "academicYear": "2024-2025",
            "academic": { "...": "..." },
            "transport": { "...": "..." },
            "hostel": { "...": "..." },
            "concessions": { "...": "..." },
            "subTotal": 100000,
            "total": { "total": 90000, "paid": 30000, "status": "Partial" },
            "facility": [
              {
                "name": "Transport Fees",
                "total": 12000,
                "paid": 4000,
                "overdue": 8000,
                "status": "Partial"
              }
            ]
          }
        ]
      }
    }
  ],
  "message": "Student fee tracking data fetched successfully"
}

No data response:

- Status: 200

{
  "success": true,
  "data": [],
  "message": "No student fee tracking data found"
}

### 2) Get Student Fee Tracking Data V2

- Method: GET
- Path: /v2
- Full route: /api/studentFeeTracking/v2
- Auth: admin

Purpose:

- frontend-friendly consolidated response with yearly summaries and per-semester fee heads

Query params:

- same as GET /

Response structure highlights per student item:

- studentCurrentAcademicYear
- feeAcademicYears array
- feeSummary array by academic year
- overall summary
- student profile block
- contact block
- academicYears detailed odd and even semester fee heads

Success response:

- Status: 200

{
  "success": true,
  "data": [
    {
      "studentCurrentAcademicYear": "2025-2026",
      "feeAcademicYears": ["2024-2025", "2025-2026"],
      "feeSummary": [
        {
          "academicYear": "2025-2026",
          "community": "BC",
          "demand": 95000,
          "concession": 5000,
          "paid": 40000,
          "overdue": 55000,
          "status": "Partial",
          "total": 100000,
          "studentType": { "transport": true, "hostel": false }
        }
      ],
      "overall": {
        "demand": 180000,
        "concession": 10000,
        "paid": 70000,
        "overdue": 110000,
        "status": "Partial",
        "total": 190000
      },
      "student": {
        "rollNo": "24CS101",
        "name": "Student A",
        "photo": "...",
        "department": "CSE",
        "section": "A",
        "batch": "2024-2028",
        "currentAcademicYear": "2025-2026"
      },
      "contact": {
        "student": { "mobile": "9876543210", "email": "a@example.com" },
        "father": { "name": "Parent", "phoneNumber": "9876500000" },
        "mother": {},
        "guardian": {}
      },
      "academicYears": [
        {
          "academicYear": "2025-2026",
          "odd": {
            "semesterNumber": 3,
            "feeHeads": [
              { "name": "Tuition Fees", "total": 42000, "concession": 2000, "paid": 20000, "overdue": 22000, "status": "Partial" }
            ],
            "overall": { "demand": 47000, "concession": 2500, "paid": 22000, "overdue": 25000, "status": "Partial", "total": 49500, "studentType": { "transport": true, "hostel": false } }
          },
          "even": {
            "semesterNumber": 4,
            "feeHeads": [],
            "overall": { "demand": 0, "concession": 0, "paid": 0, "overdue": 0, "status": "Paid", "total": 0, "studentType": { "transport": true, "hostel": false } }
          },
          "overall": { "demand": 95000, "concession": 5000, "paid": 40000, "overdue": 55000, "status": "Partial", "total": 100000, "studentType": { "transport": true, "hostel": false } }
        }
      ]
    }
  ],
  "message": "Student fee tracking data fetched successfully"
}

### 3) Backfill Missing Tracking Rows

- Method: POST
- Path: /backfill
- Full route: /api/studentFeeTracking/backfill
- Auth: superadmin

Request constraints:

- no request body
- no query params

Behavior:

- scans all students
- creates StudentFeeTracking document if missing
- computes expected academic years from student batch to currentAcademicYear
- appends only missing academicYear rows
- skips rows when fee structure or matching department mapping is unavailable
- never duplicates existing rows

Success response:

- Status: 200

{
  "success": true,
  "data": {
    "studentsScanned": 250,
    "trackingDocsCreated": 12,
    "studentsUpdated": 80,
    "rowsAppended": 140,
    "rowsAlreadyPresent": 400,
    "skippedNoFeeStructure": 15,
    "skippedNoMatchingAcademicStructure": 9
  },
  "message": "Student fee tracking backfill completed successfully"
}

Common errors:

- 400: body or query sent for backfill
- 400: invalid filter query for GET routes

## Derived and Cleaned Response Details

The service applies output cleanup and derivations:

- enrollment concession scheme blocks with isApplicable false are reduced to only:
  - { isApplicable: false }
- transport and hostel blocks are similarly cleaned when not applicable
- v1 response adds facility array for active facility charges
- v2 response computes demand, concession, paid, overdue, status at:
  - semester level
  - academic year level
  - overall student level

## Suggested Test Checklist

- GET with no filters
- GET with batch only
- GET with department case variants
- GET with rollNo exact match
- GET invalid batch, department, rollNo
- GET /v2 response shape validation
- POST /backfill idempotency by running twice
