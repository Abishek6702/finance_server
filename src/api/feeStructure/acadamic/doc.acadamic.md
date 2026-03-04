# Fee Structure Module — API Documentation

## 1. Module Overview

The **Fee Structure** module allows superadmins to define the master fee template for an academic year. This template drives automatic fee-ledger creation whenever a new student is enrolled.

**Dependencies / Coupling**
- **Students module** — reads this structure when creating a student to populate the `StudentFeeTracking` ledger.
- **Student Fee Tracking module** — when a fee structure is updated (`PUT`), existing tracking records for matching students are propagated automatically.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `feestructuremasters` | `FeeStructureMaster` | Hierarchical fee template per academic year |

---

## 2. API Documentation

> **All endpoints require `Superadmin` authentication.**  
> Include `Authorization: Bearer <token>` header.

---

### POST `/api/feeStructureMaster`

**Auth required:** Yes — Superadmin

**Description:** Creates a new fee structure for the given academic year. Auto-computes semester, department, and top-level totals via pre-validate hooks.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `academicYear` | `string` | Yes | Format `YYYY-YYYY` (e.g. `2025-2026`) |
| `academicStructures` | `array` | No | Array of quota/department/semester fee definitions |

**`academicStructures[]` object**

| Field | Type | Required | Allowed values |
|---|---|---|---|
| `quota` | string | Yes | `Management Quota`, `Government Quota` |
| `educationType` | string | Yes | `UG`, `PG` |
| `degreeProgram` | string | Yes | `BE`, `BTech`, `ME`, `MTech` |
| `departments` | array | Yes | Array of department objects (see below) |

**`departments[]` object**

| Field | Type | Required | Allowed values |
|---|---|---|---|
| `departmentName` | string | Yes | `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `semesters` | array | Yes | Exactly **8** semester objects |

**`semesters[]` object**

| Field | Type | Required | Description |
|---|---|---|---|
| `semesterNumber` | number | Yes | `1`–`8` |
| `tuition.fee` | number | No | Tuition fee amount |
| `exam.fee` | number | No | Exam fee amount |
| `erp.fee` | number | No | ERP fee amount |
| `book.fee` | number | No | Book fee amount |
| `lab.fee` | number | No | Lab fee amount |



##### Example Request Body
```json
{
  "academicYear": "2025-2026",
  "academicStructures": [
    {
      "quota": "Management Quota",
      "educationType": "UG",
      "degreeProgram": "BE",
      "departments": [
        {
          "departmentName": "CSE",
          "semesters": [
            { "semesterNumber": 1, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 2, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 3, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 4, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 5, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 6, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 7, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 8, "tuition": { "fee": 75000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } }
          ]
        }
      ]
    }
  ]
}
```

#### Validation

| Rule | Error |
|---|---|
| `academicYear` missing or not `YYYY-YYYY` format | 400 |
| `academicStructures` not an array | 400 |
| Invalid `quota`, `educationType`, or `degreeProgram` | 400 |
| `departments` not an array | 400 |
| Invalid `departmentName` | 400 |
| `semesters` length ≠ 8 | 400 |
| Duplicate `academicYear` | 400 (unique constraint) |

#### Response

**201 — Created**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c10",
    "academicYear": "2025-2026",
    "academicStructures": [ "..." ]
  }
}
```
    "total": { "fee": 642000 },
    "isActive": true,
    "createdAt": "2025-06-01T10:00:00.000Z",
    "updatedAt": "2025-06-01T10:00:00.000Z"
  },
  "message": "Fee structure created successfully"
}
```

**400 — Validation error**
```json
{
  "success": false,
  "data": null,
  "message": "Each department must have exactly 8 semesters."
}
```

**401 / 403 — Auth error**
```json
{
  "success": false,
  "data": null,
  "message": "Not authorized"
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

### GET `/api/feeStructureMaster`

**Auth required:** Yes — Superadmin

**Description:** Returns all fee structure records in the database.

#### Request

No parameters.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c10",
      "academicYear": "2025-2026",
      "academicStructures": [ "..." ]
    }
  }
}
```
      "total": { "fee": 642000 },
      "isActive": true
    }
  ],
  "message": "Fee structures fetched successfully"
}
```

---

### GET `/api/feeStructureMaster/:academicYear`

**Auth required:** Yes — Superadmin

**Description:** Returns a single fee structure record by academic year.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `academicYear` | string | Yes | e.g. `2025-2026` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c10",
    "academicYear": "2025-2026",
    "academicStructures": [ "..." ]
  }
}
```
    "total": { "fee": 642000 },
    "isActive": true
  },
  "message": "Fee structure fetched successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Fee structure not found for year 2025-2026"
}
```

---

### PUT `/api/feeStructureMaster/:academicYear`

**Auth required:** Yes — Superadmin

**Description:** Updates an existing fee structure. Propagates fee changes to existing `StudentFeeTracking` records whose `currentAcademicYear` matches. Returns the count of tracking records updated.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `academicYear` | string | Yes | e.g. `2025-2026` |

##### Body Schema

Same as `POST`. Only provided fields are updated.

##### Example Request Body
```json
{
  "academicYear": "2025-2026",
  "academicStructures": [
    {
      "quota": "Management Quota",
      "educationType": "UG",
      "degreeProgram": "BE",
      "departments": [
        {
          "departmentName": "CSE",
          "semesters": [
            { "semesterNumber": 1, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 2, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 3, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 4, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 5, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 6, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 7, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } },
            { "semesterNumber": 8, "tuition": { "fee": 80000 }, "exam": { "fee": 1500 }, "erp": { "fee": 500 }, "book": { "fee": 1000 }, "lab": { "fee": 2000 } }
          ]
        }
      ]
    }
  ]
}
```

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "feeStructure": { "academicYear": "2025-2026", "..." : "..." },
    "trackingRecordsUpdated": 42
  },
  "message": "Fee structure updated successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Fee structure not found for year 2025-2026"
}
```

---

### DELETE `/api/feeStructureMaster/:academicYear`

**Auth required:** Yes — Superadmin

**Description:** Permanently deletes a fee structure record by academic year.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `academicYear` | string | Yes | e.g. `2025-2026` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": null,
  "message": "Fee structure deleted successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Fee structure not found for year 2025-2026"
}
```

---

## 3. Edge Cases

- **Auto-computed totals:** Semester totals, department totals, and the master total are all computed automatically via Mongoose pre-validate hooks. Do not send `total` fields in the request body — they will be overwritten.
- **`isActive` flag:** Setting `isActive: false` on a semester, department, or academic structure zeroes its contribution to parent totals.
- **Propagation on update:** A `PUT` re-calculates and updates fee amounts in all `StudentFeeTracking` documents for the matching year. Only the `total` demand fields are updated; already-paid amounts are preserved.
- **Duplicate year:** Attempting to create two structures for the same `academicYear` returns a MongoDB duplicate-key error (`400`).
- **Deletion impact:** Deleting a fee structure does **not** cascade-delete student tracking records. Existing tracking records retain their fee amounts even after the master structure is removed.

---

### POST `/api/feeStructureMaster/bulk`

**Auth required:** Yes — Superadmin

**Description:** Creates or updates one or many academic year fee structures from a flat CSV or Excel file. The upsert key is `academicYear` at the document level. Rows for the same `academicYear + quota + educationType + degreeProgram + departmentName` are merged into the existing document; missing semesters are padded with `fee: 0`. When an **existing** academic year is updated, student tracking records are propagated automatically (same as `PUT`).

An **empty `quota` column** signals "not applicable for this quota" — those rows are silently skipped.

Row-level errors (invalid enum values, bad semester numbers, etc.) are collected and returned in `rowErrors`. If all rows are invalid the endpoint returns `400`; if some rows are invalid it returns `207 Multi-Status`.

#### Request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | CSV or Excel (`.csv`, `.xls`, `.xlsx`), max 10 MB |

##### CSV Column Schema

| Column | Required | Description |
|---|---|---|
| `academicYear` | Yes | `YYYY-YYYY` format, e.g. `2025-2026` |
| `quota` | Yes* | `Management Quota` or `Government Quota`. **Leave empty to skip the row** (quota not applicable). |
| `educationType` | Yes | `UG` or `PG` |
| `degreeProgram` | Yes | `BE`, `BTech`, `ME`, `MTech` |
| `departmentName` | Yes | `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `semesterNumber` | Yes | `1` – `8` |
| `tuition` | Yes | Number ≥ 0 |
| `exam` | Yes | Number ≥ 0 |
| `erp` | Yes | Number ≥ 0 |
| `book` | Yes | Number ≥ 0 |
| `lab` | Yes | Number ≥ 0 |
| `isActive` | No | `true` / `false`, defaults to `true` |

##### Example CSV (2023-2027 batch, UG CSE, both quotas)

The ready-to-use example file is located at `src/data/example_fee_structure_bulk.csv`.

```
academicYear,quota,educationType,degreeProgram,departmentName,semesterNumber,tuition,exam,erp,book,lab,isActive
2023-2024,Government Quota,UG,BE,CSE,1,40000,2000,500,1000,1500,true
2023-2024,Government Quota,UG,BE,CSE,2,40000,2000,500,1000,1500,true
...
2023-2024,Management Quota,UG,BE,CSE,1,75000,2000,500,1000,1500,true
...
2026-2027,Management Quota,UG,BE,CSE,8,84000,2000,500,1000,1500,true
```

> To mark a quota as **not applicable** for a department/year, simply leave its rows out (or put an empty `quota` cell — both are silently skipped).

#### Response

**200 — All rows valid, upsert complete**
```json
{
  "success": true,
  "data": {
    "created": ["2023-2024", "2024-2025"],
    "updated": ["2025-2026"],
    "propagated": { "2025-2026": 3 },
    "rowErrors": []
  },
  "message": "Bulk upsert complete. Created: 2, Updated: 1"
}
```

**207 — Upsert complete but some rows had validation errors**
```json
{
  "success": false,
  "data": {
    "created": ["2023-2024"],
    "updated": [],
    "propagated": {},
    "rowErrors": [
      { "row": 5, "error": "Invalid quota: \"Wrong Quota\"" }
    ]
  },
  "message": "Bulk upsert complete. Created: 1, Updated: 0, Errors: 1"
}
```

**400 — No file / empty file / missing column / all rows invalid**
```json
{
  "success": false,
  "data": null,
  "message": "No valid rows found after validation."
}
```

---

