# Students Module — API Documentation

## 1. Module Overview

The **Students** module manages full student lifecycle: creation, retrieval, update, deletion, and bulk import via CSV/Excel. On student creation, a corresponding `StudentFeeTracking` and `StudentTransaction` record are automatically generated.

**Dependencies / Coupling**
- **Fee Structure module** — fee amounts are read from `FeeStructureMaster` at creation time to populate the fee ledger.
- **Student Fee Tracking module** — a tracking record is auto-created for every new student.
- **Transaction module** — a transaction shell document is auto-created for every new student.
- **Hostel / Transport modules** — hostel and transport fees are resolved from their respective collections if the student is enrolled in either.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `students` | `Student` | Core student profile |
| `studentfeetrackings` | `StudentFeeTracking` | Auto-created fee ledger per student |
| `studenttransactions` | `StudentTransaction` | Auto-created transaction shell per student |

---

## 2. API Documentation

> **All endpoints require `Superadmin` authentication.**  
> Include `Authorization: Bearer <token>` header.

---

### POST `/api/studentsManagement`

**Auth required:** Yes — Superadmin

**Description:** Creates a single student record and auto-generates their fee tracking and transaction documents.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `personal` | object | Yes | Personal details (see below) |
| `academic` | object | Yes | Academic details (see below) |
| `contact` | object | No | Contact details |
| `family` | object | No | Family details |
| `address` | object | No | Address details |
| `enrollment` | object | Yes | Quota and concession details |
| `transport` | object | No | Transport enrollment |
| `hostel` | object | No | Hostel enrollment |

**`personal` object**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `rollNo` | string | Yes | Format `DDLLNNN` (e.g. `25CS101`) — unique |
| `registerNumber` | string | No | — |
| `studentName` | string | No | — |
| `gender` | string | No | `Male`, `Female`, `Other` |
| `dob` | date | No | ISO date string |
| `bloodGroup` | string | No | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `aadharNo` | string | No | Exactly 12 digits |
| `emisNo` | string | No | — |
| `religion` | string | No | — |
| `community` | string | No | max 50 characters |
| `casteName` | string | No | max 50 characters |
| `nationality` | string | No | — |

**`academic` object**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `degreeProgram` | string | Yes | `BE`, `BTech`, `ME`, `MTech` |
| `batch` | string | Yes | Format `YYYY-YYYY` |
| `currentAcademicYear` | string | Yes | Format `YYYY-YYYY` |
| `departmentName` | string | Yes | `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `yearStudying` | number | Yes | `1`–`4` |
| `currentSemesterNumber` | number | Yes | `1`–`8`; **must match `batch` + `currentAcademicYear`**: derived study year = `parseInt(currentAcademicYear) − parseInt(batch) + 1`; valid values are `studyYear×2−1` (odd) or `studyYear×2` (even). E.g. batch `2022-2026`, academicYear `2024-2025` → studyYear 3 → only `5` or `6` accepted |
| `educationType` | string | No | `UG`, `PG` |
| `academicType` | string | No | `REG`, `PART_TIME` |
| `isLateralEntry` | boolean | No | — |
| `section` | string | No | `A`–`F` |

**`contact` object**

| Field | Type | Constraints |
|---|---|---|
| `selfMobileNo` | string | Valid 10-digit Indian number (starts `6`–`9`) |
| `selfEmail` | string | Valid email |
| `officialEmail` | string | Must end with `@sece.ac.in` |

**`enrollment` object**

| Field | Type | Required | Description |
|---|---|---|---|
| `quota` | string | Yes | `Management Quota`, `Government Quota` |
| `firstGraduate` | object | No | `isApplicable` + yearly concession amounts |
| `scheme7point5` | object | No | `isApplicable` + yearly concession amounts |
| `pmssScheme` | object | No | `isApplicable` + yearly concession amounts |
| `sakthiScheme` | object | No | `isApplicable` + yearly concession amounts |
| `specialConcession` | object | No | `isApplicable` + yearly concession amounts |

**Concession sub-object fields** (all `number`, non-negative):
`yearlyLabConcessionAmount`, `yearlyBookConcessionAmount`, `yearlyErpConcessionAmount`, `yearlyExamConcessionAmount`, `yearlyTransportConcessionAmount`, `yearlyHostelConcessionAmount`, `yearlyTuitionConcessionAmount`

**`transport` object**

| Field | Type | Description |
|---|---|---|
| `isApplicable` | boolean | Whether student uses college transport |
| `route` | string | Route name |
| `busNo` | string | Bus number |
| `stop` | string | Boarding stop |
| `fee` | number | Transport fee |

**`hostel` object**

| Field | Type | Description |
|---|---|---|
| `isApplicable` | boolean | Whether student resides in hostel |
| `block` | string | Hostel block (e.g. `A`) |
| `sharing` | number | `2`, `3`, `4`, or `5` |
| `isAttached` | boolean | Attached bathroom |
| `fee` | number | Hostel fee |

##### Example Request Body
```json
{
  "personal": {
    "rollNo": "25CS101",
    "registerNumber": "713521104001",
    "studentName": "Arun Kumar",
    "gender": "Male",
    "dob": "2006-07-15",
    "bloodGroup": "O+",
    "aadharNo": "123456789012",
    "religion": "Hindu",
    "community": "OBC",
    "nationality": "Indian"
  },
  "academic": {
    "educationType": "UG",
    "academicType": "REG",
    "isLateralEntry": false,
    "departmentName": "CSE",
    "degreeProgram": "BE",
    "yearStudying": 1,
    "currentSemesterNumber": 1,
    "section": "A",
    "batch": "2025-2029",
    "currentAcademicYear": "2025-2026"
  },
  "contact": {
    "selfMobileNo": "9876543210",
    "selfEmail": "arun@gmail.com",
    "officialEmail": "arun.25cs101@sece.ac.in"
  },
  "family": {
    "father": { "name": "Kumar S", "mobile": "9876500001", "workType": "Business", "qualification": "HSC" }
  },
  "enrollment": {
    "quota": "Government Quota",
    "firstGraduate": {
      "isApplicable": true,
      "yearlyTuitionConcessionAmount": 5000
    }
  },
  "transport": {
    "isApplicable": true,
    "route": "Route 1",
    "busNo": "TN-01-AB-1234",
    "stop": "Erode",
    "fee": 12000
  },
  "hostel": {
    "isApplicable": false
  }
}
```

#### Validation

| Rule | Error |
|---|---|
| `personal` or `academic` missing | 400 |
| `personal.rollNo` missing or wrong format | 400 |
| `academic.degreeProgram`, `batch`, or `currentAcademicYear` missing | 400 |
| Invalid enums (gender, bloodGroup, department, etc.) | 400 |
| `aadharNo` not 12 digits | 400 |
| `selfMobileNo` not a valid 10-digit Indian number | 400 |
| `officialEmail` not `@sece.ac.in` | 400 |
| Duplicate `rollNo` | 400 |

#### Response

**201 — Created**
```json
{
  "success": true,
  "data": {
    "personal": { "rollNo": "25CS101", "studentName": "Arun Kumar", "..." : "..." },
    "academic": { "departmentName": "CSE", "..." : "..." },
    "contact": { "..." : "..." },
    "enrollment": { "..." : "..." },
    "transport": { "..." : "..." },
    "hostel": { "..." : "..." },
    "_id": "665f1a2b3c4d5e6f7a8b9c20",
    "createdAt": "2025-06-01T10:00:00.000Z"
  },
  "message": "Student created successfully"
}
```

**400 — Validation error**
```json
{
  "success": false,
  "data": null,
  "message": "personal.rollNo format is invalid (expected 12CS101)"
}
```

---

### POST `/api/studentsManagement/bulk`

**Auth required:** Yes — Superadmin

**Description:** Bulk-creates students from an uploaded CSV or Excel file. Returns a `201` if all rows succeed, or `207 Multi-Status` if any rows fail.

#### Request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | `.csv`, `.xls`, or `.xlsx` file (max 10 MB) |

Each row in the file must match the student field structure (column headers correspond to field paths).

#### Response

**201 — All created**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 3, "created": 3, "failed": 0 },
    "created": ["25CS101", "25CS102", "25CS103"],
    "failed": []
  },
  "message": "All students created successfully"
}
```

**207 — Partial success**
```json
{
  "success": false,
  "data": {
    "summary": { "total": 3, "created": 2, "failed": 1 },
    "created": ["25CS101", "25CS102"],
    "failed": [
      { "row": 3, "rollNo": "25CS103", "error": "Duplicate rollNo" }
    ]
  },
  "message": "2 created, 1 failed"
}
```

**400 — No file**
```json
{
  "success": false,
  "data": null,
  "message": "No file uploaded – send a CSV or Excel file in the 'file' field"
}
```

---

### PUT `/api/studentsManagement/bulk`

**Auth required:** Yes — Superadmin

**Description:** Bulk-updates students from a CSV or Excel file. Rows are matched by `rollNo`; only provided fields are updated.

#### Request

Same as `POST /bulk` — `multipart/form-data` with a `file` field.

#### Response

**200 — All updated**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 2, "updated": 2, "failed": 0 },
    "updated": ["25CS101", "25CS102"],
    "failed": []
  },
  "message": "All students updated successfully"
}
```

---

### GET `/api/studentsManagement`

**Auth required:** Yes — Superadmin

**Description:** Returns all student records.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [ { "personal": { "rollNo": "25CS101" }, "..." : "..." } ],
  "message": "Students fetched successfully"
}
```

---

### GET `/api/studentsManagement/:rollNo`

**Auth required:** Yes — Superadmin

**Description:** Returns a single student by roll number.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | Yes | e.g. `25CS101` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "personal": { "rollNo": "25CS101", "studentName": "Arun Kumar" },
    "academic": { "departmentName": "CSE", "batch": "2025-2029" },
    "contact": { "selfMobileNo": "9876543210" }
  },
  "message": "Student fetched successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Student not found"
}
```

---

### PUT `/api/studentsManagement/:rollNo`

**Auth required:** Yes — Superadmin

**Description:** Updates a student's fields. Only provided fields are updated (partial update).

#### Request

##### Path Parameters

| Parameter | Type | Required |
|---|---|---|
| `rollNo` | string | Yes |

##### Body Schema

Same nested structure as `POST`. All fields are optional. Same enum and format validations apply.

##### Example Request Body
```json
{
  "academic": {
    "yearStudying": 2,
    "currentSemesterNumber": 3
  },
  "contact": {
    "selfMobileNo": "9123456789"
  }
}
```

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": { "personal": { "rollNo": "25CS101" }, "..." : "..." },
  "message": "Student updated successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Student not found"
}
```

---

### DELETE `/api/studentsManagement/:rollNo`

**Auth required:** Yes — Superadmin

**Description:** Permanently deletes a student and their associated `StudentFeeTracking` record.

#### Request

##### Path Parameters

| Parameter | Type | Required |
|---|---|---|
| `rollNo` | string | Yes |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": null,
  "message": "Student and fee tracking deleted successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Student not found"
}
```

---

## 3. Edge Cases

- **Auto fee ledger creation:** When a student is created, the service looks up the `FeeStructureMaster` for `currentAcademicYear`, resolves the correct quota/department/semester fees, and writes them into a `StudentFeeTracking` document. If no fee structure is found for the year, the tracking record is created with zero totals.
- **Hostel/transport fee resolution:** If `hostel.isApplicable` or `transport.isApplicable` is `true`, the service looks up the matching `Hostel` or `Transport` document to populate the fee. Mismatched configurations (e.g., unknown block + sharing combination) are recorded as zero.
- **Bulk file format:** Accepted MIME types: `text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Files with unknown extensions but matching one of these MIME types are also accepted.
- **Bulk partial failure (207):** Failing rows do not roll back successfully created rows. Each row is processed independently.
- **Delete cascade:** Deleting a student removes both the `Student` document and the linked `StudentFeeTracking` document. The `StudentTransaction` document is **not** deleted to preserve payment history.
- **`rollNo` uniqueness:** Roll number is validated against the regex `^\d{2}[A-Z]{2}\d{3}$` (e.g. `25CS101`) and must be globally unique.





