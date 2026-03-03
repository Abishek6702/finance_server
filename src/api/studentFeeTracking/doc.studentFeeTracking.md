# Student Fee Tracking Module — API Documentation

## 1. Module Overview

The **Student Fee Tracking** module provides a read-only view of per-student fee ledgers, combined with their full student profile. Records are created automatically when a student is added and updated whenever a payment is recorded.

**Dependencies / Coupling**
- **Students module** — tracking records are created by the students service on `POST /studentsManagement`.
- **Transaction module** — payment recording updates `paid` amounts and `status` fields inside tracking records.
- **Fee Structure module** — initial `total` demand values are populated from `FeeStructureMaster` at student creation.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `students` | `Student` | Source of student profile data |
| `studentfeetrackings` | `StudentFeeTracking` | Per-student, per-year fee ledger |

---

## 2. API Documentation

> **All endpoints require `Admin` authentication** (admin or superadmin).  
> Include `Authorization: Bearer <token>` or the `token` cookie.

---

### GET `/api/studentFeeTracking`

**Auth required:** Yes — Admin (`admin` or `superadmin`)

**Description:** Returns a list of students with their associated fee tracking records. Supports filtering by `batch`, `department`, and `rollNo`.

#### Request

##### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `batch` | string | No | Format `YYYY-YYYY` (e.g. `2025-2029`) |
| `department` | string | No | One of: `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` (case-insensitive) |
| `rollNo` | string | No | Exact roll number (e.g. `25CS101`) |

##### Example Request

```
GET /api/studentFeeTracking?batch=2025-2029&department=CSE
```

#### Validation

| Rule | Error |
|---|---|
| `department` is not in the allowed list | 400 |
| `batch` not in `YYYY-YYYY` format | 400 |
| `rollNo` contains non-alphanumeric characters | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    {
      "student": {
        "_id": "665f1a2b3c4d5e6f7a8b9c20",
        "personal": {
          "rollNo": "25CS101",
          "studentName": "Arun Kumar",
          "gender": "Male"
        },
        "academic": {
          "departmentName": "CSE",
          "degreeProgram": "BE",
          "batch": "2025-2029",
          "currentAcademicYear": "2025-2026",
          "currentSemesterNumber": 1
        },
        "contact": {
          "selfMobileNo": "9876543210",
          "officialEmail": "arun.25cs101@sece.ac.in"
        }
      },
      "feeTracking": {
        "_id": "665f1a2b3c4d5e6f7a8b9c30",
        "rollNo": "25CS101",
        "academicYearWiseRecord": [
          {
            "academicYear": "2025-2026",
            "academic": {
              "odd": {
                "tuition": { "total": 75000, "paid": 30000, "status": "Partially Paid" },
                "exam":    { "total": 1500,  "paid": 1500,  "status": "Paid" },
                "erp":     { "total": 500,   "paid": 0,     "status": "Unpaid" },
                "book":    { "total": 1000,  "paid": 0,     "status": "Unpaid" },
                "lab":     { "total": 2000,  "paid": 0,     "status": "Unpaid" },
                "total":   { "total": 80000, "paid": 31500, "status": "Partially Paid" }
              },
              "even": { "..." : "..." },
              "total": { "total": 160000, "paid": 31500, "status": "Partially Paid" }
            },
            "hostel": {
              "block": "A",
              "sharing": 2,
              "isAttached": true,
              "fee": 70000,
              "total": { "total": 70000, "paid": 0, "status": "Unpaid" }
            },
            "transport": {
              "route": "Route 1",
              "busNo": "TN-01-AB-1234",
              "stop": "Erode",
              "fee": 12000,
              "total": { "total": 12000, "paid": 0, "status": "Unpaid" }
            },
            "concessions": {
              "firstGraduate": 5000,
              "scheme7point5": 0,
              "pmss": 0,
              "sakthi": 0,
              "totalConcession": 5000
            },
            "total": { "total": 242000, "paid": 31500, "status": "Partially Paid" }
          }
        ]
      }
    }
  ],
  "message": "Student fee tracking data fetched successfully"
}
```

**200 — No results** (filters match zero students)
```json
{
  "success": true,
  "data": [],
  "message": "Student fee tracking data fetched successfully"
}
```

**400 — Invalid department**
```json
{
  "success": false,
  "data": null,
  "message": "department must be one of: CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL"
}
```

**400 — Invalid batch format**
```json
{
  "success": false,
  "data": null,
  "message": "batch must be in YYYY-YYYY format"
}
```

**401 — Not authenticated**
```json
{
  "success": false,
  "data": null,
  "message": "Not authorized, no token"
}
```

**403 — Insufficient role**
```json
{
  "success": false,
  "data": null,
  "message": "Not authorized as admin"
}
```

**500 — Internal server error**
```json
{
  "success": false,
  "data": null,
  "message": "Internal server error"
}
```

---

## 3. Edge Cases

- **Combined data response:** Each result item contains the full `student` document paired with its `feeTracking` document. If a tracking record does not exist for a student, `feeTracking` is `null`.
- **Filter behaviour:** All filters are ANDed together. Providing no filters returns every student with their tracking record.
- **`department` is case-insensitive** in the query parameter but is matched case-insensitively against the stored department name.
- **`rollNo` filter** is an exact match; partial roll number queries are not supported via this endpoint.
- **Status values** for each fee component: `Unpaid` (paid = 0), `Partially Paid` (0 < paid < total), `Paid` (paid ≥ total). These are computed by the transaction service on payment.
- **Read-only endpoint:** This module exposes no mutation endpoints. All writes to tracking records happen via the Transaction module.

---

## 4. Fee Tracking Record Structure Reference

```
academicYearWiseRecord[]
├── academicYear: "YYYY-YYYY"
├── academic
│   ├── odd  (semesters 1, 3, 5, 7)
│   │   ├── tuition / exam / erp / book / lab
│   │   │     └── { total, paid, status }
│   │   └── total: { total, paid, status }
│   ├── even (semesters 2, 4, 6, 8)
│   │   └── (same structure as odd)
│   ├── academicSpecialConcession
│   └── total: { total, paid, status }
├── hostel
│   ├── block, sharing, isAttached, fee
│   ├── hostelSpecialConcession
│   └── total: { total, paid, status }
├── transport
│   ├── route, busNo, stop, fee
│   ├── transportSpecialConcession
│   └── total: { total, paid, status }
├── concessions
│   ├── firstGraduate, scheme7point5, pmss, sakthi
│   └── totalConcession
└── total: { total, paid, status }
```







**Subject: Clarification on Batch, Academic Year, and Semester Mapping in Fee Ledger System**

This is to formally clarify the definitions and relationships between *Batch*, *Academic Year*, and *Semester* as implemented in the student fee ledger system to avoid confusion and ensure consistency across departments.

---

### 1. Batch

**Batch** represents the total duration of a student’s program.

Example:
Batch **2024–2028** indicates:

* Admission Year: 2024
* Completion Year: 2028
* Duration: 4 Academic Years
* Total Semesters: 8 (for UG programs)

Batch remains constant for the entire course duration and defines the overall academic lifecycle of the student.

---

### 2. Academic Year

An **Academic Year** represents one study year within the batch duration.

For Batch 2024–2028, the valid academic years are:

* 2024–2025 (1st Year)
* 2025–2026 (2nd Year)
* 2026–2027 (3rd Year)
* 2027–2028 (4th Year)

There are only 4 academic years for a 4-year UG program.
Academic Year 2028–2029 does **not** belong to Batch 2024–2028.

---

### 3. Semester

Each Academic Year consists of **two semesters**:

| Study Year | Academic Year | Odd Semester | Even Semester |
| ---------- | ------------- | ------------ | ------------- |
| 1st Year   | 2024–2025     | Semester 1   | Semester 2    |
| 2nd Year   | 2025–2026     | Semester 3   | Semester 4    |
| 3rd Year   | 2026–2027     | Semester 5   | Semester 6    |
| 4th Year   | 2027–2028     | Semester 7   | Semester 8    |

For a standard UG program:

* Maximum Semesters = 8
* No Semester 9 or 10 exists.

---

### Structural Relationship

The hierarchy is:

Batch
→ Academic Year
→ Semester

Ledger generation and fee calculation strictly follow this structure.
Academic years and semesters beyond the batch duration will not be generated in the system.

---

This clarification is issued to ensure uniform understanding across departments and prevent inconsistencies in academic and financial records.

If any further clarification is required, it can be addressed through the system documentation or technical review meeting.
