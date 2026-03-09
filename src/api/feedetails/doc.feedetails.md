# Fee Details Module — API Documentation

## 1. Module Overview

The **Fee Details** module provides purpose-built read-only views of student fee data optimised for frontend table and detail screens. It composes data from the `Student` and `StudentFeeTracking` collections and exposes three graduated endpoints: a filterable summary list, a per-student year-wise breakdown, and a semester-level fee head drill-down.

**Dependencies**

| Collection | Model | Purpose |
|---|---|---|
| `students` | `Student` | Student profile, contact, family, transport/hostel flags |
| `studentfeetrackings` | `StudentFeeTracking` | Per-year, per-semester fee ledger |

> `fine` is always `0` — fine tracking is not yet modelled.  
> `demand` = NET fee after concession (`total.total`).  
> `total` (where present) = GROSS fee before concession (`subTotal`).

**Auth:** All endpoints require **Admin** authentication (`admin` or `superadmin`).  
Include `Authorization: Bearer <token>`.

---

## 2. Endpoints

---

### GET `/api/feedetails`

**Description:** Returns a flat summary list of students with their aggregated fee totals. Supports filtering by `rollNo` (exact), `batch`, `department`, and `academicYear`. All matching records are returned (no pagination).

#### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | No | Exact roll number (e.g. `25CS150`) |
| `batch` | string | No | Format `YYYY-YYYY` (e.g. `2025-2029`) |
| `department` | string | No | One of: `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `academicYear` | string | No | Format `YYYY-YYYY` — limits fee aggregation to this year only |

#### Validation

| Rule | HTTP |
|---|---|
| `department` not in allowed list | 400 |
| `batch` not in `YYYY-YYYY` format | 400 |
| `academicYear` not in `YYYY-YYYY` format | 400 |
| `rollNo` contains non-alphanumeric characters | 400 |

#### Response — 200

```json
{
  "success": true,
  "data": [
    {
      "student": {
        "rollNo": "25CS150",
        "name": "Arun Prakash",
        "photo": "https://example.com/student-photo.jpg",
        "department": "CSE",
        "year": 1
      },
      "fee": {
        "demand": 83000,
        "concession": 25000,
        "paid": 6000,
        "overdue": 77000,
        "status": "Partially Paid"
      },
      "studentType": {
        "transport": true,
        "hostel": false
      }
    }
  ],
  "pagination": {
    "totalRecords": 1
  },
  "message": "Fee details fetched successfully"
}
```

**Fee field semantics**

| Field | Source |
|---|---|
| `demand` | `yearRecord.total.total` (NET, after concession) |
| `concession` | `yearRecord.concessions.totalConcession` |
| `paid` | `yearRecord.total.paid` |
| `overdue` | `demand − paid` |

---

### GET `/api/feedetails/:rollNo`

**Description:** Returns year-by-year fee summary for a single student. Optionally includes student profile and contact details.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | Yes | Exact roll number |

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `includeProfile` | boolean | `true` | When `false`, omits `student` and `contact` blocks |

#### Validation

| Rule | HTTP |
|---|---|
| `rollNo` contains non-alphanumeric characters | 400 |
| `includeProfile` is not `"true"` or `"false"` | 400 |
| Student not found | 404 |

#### Response — 200

```json
{
  "success": true,
  "data": {
    "student": {
      "rollNo": "25CS150",
      "name": "Arun Prakash",
      "photo": "https://example.com/student-photo.jpg",
      "department": "CSE",
      "section": "B",
      "batch": "2025-2029"
    },
    "contact": {
      "student": { "mobile": "9876543210", "email": "arun@mail.com" },
      "father": { "name": "Prakash", "phoneNumber": "9876543000" },
      "mother": { "name": "Lakshmi", "phoneNumber": "9876543111" },
      "guardian": { "name": "Ramesh", "phoneNumber": "9876543222" }
    },
    "feeSummary": [
      {
        "academicYear": "2025-2026",
        "community": "BC",
        "demand": 50000,
        "concession": 2000,
        "paid": 2100,
        "fine": 0,
        "overdue": 47900,
        "status": "Partially Paid",
        "total": 52000,
        "studentType": { "transport": true, "hostel": false }
      }
    ],
    "overall": {
      "demand": 50000,
      "concession": 2000,
      "paid": 2100,
      "fine": 0,
      "overdue": 47900,
      "status": "Partially Paid",
      "total": 52000
    }
  },
  "message": "Student fee year-wise summary fetched successfully"
}
```

---

### GET `/api/feedetails/:rollNo/:academicYear`

**Description:** Returns semester-level fee head breakdown for one academic year. Transport and hostel fees are attached to the **Odd** semester block.

#### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | Yes | Exact roll number |
| `academicYear` | string | Yes | Format `YYYY-YYYY` |

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `semester` | string | (both) | `odd` or `even` — filter to a single semester |
| `includeProfile` | boolean | `true` | When `false`, omits `student` and `contact` blocks |

#### Validation

| Rule | HTTP |
|---|---|
| `rollNo` contains non-alphanumeric characters | 400 |
| `academicYear` not in `YYYY-YYYY` format | 400 |
| `semester` not `"odd"` or `"even"` | 400 |
| `includeProfile` not `"true"` or `"false"` | 400 |
| Student not found | 404 |
| Fee tracking record not found | 404 |
| Academic year not found in tracking | 404 |

#### Response — 200

```json
{
  "success": true,
  "data": {
    "student": {
      "rollNo": "25CS150",
      "name": "Arun Prakash",
      "photo": "https://example.com/student-photo.jpg",
      "department": "CSE",
      "section": "B",
      "batch": "2025-2029"
    },
    "contact": {
      "student": { "mobile": "9876543210", "email": "arun@mail.com" },
      "father": { "name": "Prakash", "phoneNumber": "9876543000" },
      "mother": { "name": "Lakshmi", "phoneNumber": "9876543111" },
      "guardian": { "name": "Ramesh", "phoneNumber": "9876543222" }
    },
    "academicYear": "2025-2026",
    "semesters": [
      {
        "semesterType": "Odd",
        "semesterNumber": 3,
        "overall": {
          "demand": 52000,
          "concession": 5000,
          "paid": 10000,
          "fine": 0,
          "overdue": 42000,
          "status": "Partially Paid",
          "total": 57000,
          "studentType": { "transport": true, "hostel": false }
        },
        "feeHeads": [
          {
            "name": "Tuition Fees",
            "total": 40000,
            "concession": 4000,
            "fine": 0,
            "paid": 9000,
            "overdue": 31000,
            "status": "Partially Paid"
          },
          {
            "name": "Transport Fees",
            "total": 6000,
            "concession": 500,
            "fine": 0,
            "paid": 1000,
            "overdue": 5000,
            "status": "Partially Paid"
          }
        ]
      },
      {
        "semesterType": "Even",
        "semesterNumber": 4,
        "overall": {
          "demand": 0,
          "concession": 0,
          "paid": 0,
          "fine": 0,
          "overdue": 0,
          "status": "Unpaid",
          "total": 0,
          "studentType": { "transport": true, "hostel": false }
        },
        "feeHeads": []
      }
    ]
  },
  "message": "Semester fee breakdown fetched successfully"
}
```

**Fee head names**

| Internal key | Display name |
|---|---|
| `tuition` | Tuition Fees |
| `exam` | Exam Fees |
| `erp` | ERP Fees |
| `book` | Book Fees |
| `lab` | Lab Fees |
| `transport` | Transport Fees (Odd semester only) |
| `hostel` | Hostel Fees (Odd semester only) |
