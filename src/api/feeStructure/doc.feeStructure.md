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
> Include `Authorization: Bearer <token>` or the `token` cookie.

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
| `hostelStructures` | `array` | No | Array of hostel block/room-type fee definitions |

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

**`hostelStructures[]` object**

| Field | Type | Required | Description |
|---|---|---|---|
| `block` | string | No | Block name (e.g. `A`) |
| `roomType.sharingType` | string | No | `Two`, `Three`, `Four`, `Five` |
| `roomType.isAttached` | boolean | No | Attached bathroom |
| `roomFee.fee` | number | No | Room fee |
| `messFee.fee` | number | No | Mess fee |
| `maintenanceFee.fee` | number | No | Maintenance fee |

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
  ],
  "hostelStructures": [
    {
      "block": "A",
      "roomType": { "sharingType": "Two", "isAttached": true },
      "roomFee": { "fee": 40000 },
      "messFee": { "fee": 25000 },
      "maintenanceFee": { "fee": 5000 }
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
| `hostelStructures` not an array | 400 |
| Invalid `hostelStructures[].roomType.sharingType` | 400 |
| Duplicate `academicYear` | 400 (unique constraint) |

#### Response

**201 — Created**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c10",
    "academicYear": "2025-2026",
    "academicStructures": [ "..." ],
    "hostelStructures": [ "..." ],
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
      "academicStructures": [ "..." ],
      "hostelStructures": [ "..." ],
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
    "academicStructures": [ "..." ],
    "hostelStructures": [ "..." ],
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
