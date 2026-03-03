# Transaction Module — API Documentation

## 1. Module Overview

The **Transaction** module handles fee payment recording, receipt generation, and payment history retrieval. Each payment can span multiple academic years and cover academic fees (broken down by semester), hostel fees, and transport fees in a single receipt.

**Dependencies / Coupling**
- **Students module** — validates that the student (`rollNo`) exists before recording a payment.
- **Student Fee Tracking module** — updates `paid` amounts and `status` per fee component after each payment.
- **`StudentTransaction` collection** — appends a payment record to the student's transaction document.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `studenttransactions` | `StudentTransaction` | Per-student transaction history |
| `studentfeetrackings` | `StudentFeeTracking` | Updated after each payment |

---

## 2. API Documentation

> **All endpoints require `Admin` authentication** (admin or superadmin).  
> Include `Authorization: Bearer <token>` or the `token` cookie.

---

### POST `/api/transaction/pay`

**Auth required:** Yes — Admin

**Description:** Records a fee payment for a student. A single receipt can include payments across multiple academic years and multiple fee heads (academic, hostel, transport). After recording, the corresponding `StudentFeeTracking` record is updated.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | Yes | Student roll number |
| `receiptNo` | string | Yes | Unique receipt number (e.g. `REC-2025-001`) |
| `paymentType` | string | Yes | `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `bankName` | string | No | Bank name (for Cheque/DD/NetBanking) |
| `bankLocation` | string | No | Bank branch location |
| `billingDate` | string / Date | No | Billing date — `dd/mm/yyyy`, ISO 8601, or Date object. Defaults to current date/time if omitted |
| `remarks` | string | No | Free-text remarks |
| `breakdowns` | array | Yes | Payment breakdown per academic year (see below) |

**`breakdowns[]` object**

| Field | Type | Required | Description |
|---|---|---|---|
| `academicYear` | string | Yes | Format `YYYY-YYYY` |
| `academic` | object | No | Academic fee component |
| `academic.semesterNumber` | number | Conditional | `1`–`8`; required when any academic fee amount > 0 |
| `academic.tuition` | number | No | Amount paid towards tuition (≥ 0, max 2 decimals) |
| `academic.exam` | number | No | Amount paid towards exam fee |
| `academic.erp` | number | No | Amount paid towards ERP fee |
| `academic.book` | number | No | Amount paid towards book fee |
| `academic.lab` | number | No | Amount paid towards lab fee |
| `hostel` | number | No | Amount paid towards hostel fee (≥ 0, max 2 decimals) |
| `transport` | number | No | Amount paid towards transport fee (≥ 0, max 2 decimals) |

##### Example Request Body
```json
{
  "rollNo": "25CS101",
  "receiptNo": "REC-2025-001",
  "paymentType": "Cash",
  "billingDate": "15/08/2025",
  "remarks": "First semester fee payment",
  "breakdowns": [
    {
      "academicYear": "2025-2026",
      "academic": {
        "semesterNumber": 1,
        "tuition": 75000,
        "exam": 1500,
        "erp": 500,
        "book": 1000,
        "lab": 2000
      },
      "hostel": 70000,
      "transport": 12000
    }
  ]
}
```

#### Validation

| Rule | Error |
|---|---|
| `rollNo` missing | 400 — `rollNo is required` |
| `receiptNo` missing | 400 — `receiptNo is required` |
| `paymentType` missing or invalid | 400 — `Valid paymentType is required` |
| `breakdowns` missing or empty array | 400 — `breakdowns array is required` |
| `breakdown.academicYear` not in `YYYY-YYYY` format | 400 |
| `academic.semesterNumber` out of range `1`–`8` | 400 |
| `academic.semesterNumber` absent when academic amount > 0 | 400 |
| Any fee amount is negative or has more than 2 decimal places | 400 |
| Any amount exceeds the remaining due for that component | 400 (overpayment prevention) |
| `rollNo` does not correspond to an existing student | 404 |

#### Response

**201 — Success**
```json
{
  "success": true,
  "data": {
    "receiptNo": "REC-2025-001",
    "paymentType": "Cash",
    "billingDate": "2025-08-15T00:00:00.000Z",
    "paidOn": "2025-06-01T10:00:00.000Z",
    "totalAmount": 162000,
    "breakdowns": [
      {
        "academicYear": "2025-2026",
        "academic": {
          "semesterNumber": 1,
          "tuition": 75000,
          "exam": 1500,
          "erp": 500,
          "book": 1000,
          "lab": 2000
        },
        "hostel": 70000,
        "transport": 12000,
        "total": 162000
      }
    ]
  },
  "message": "Payment recorded successfully"
}
```

**400 — Overpayment**
```json
{
  "success": false,
  "data": null,
  "message": "Payment amount exceeds remaining due for tuition in semester 1 (2025-2026)"
}
```

**400 — Validation error**
```json
{
  "success": false,
  "data": null,
  "message": "academic.semesterNumber is required when academic fee amounts are provided"
}
```

**404 — Student not found**
```json
{
  "success": false,
  "data": null,
  "message": "Student not found"
}
```

---

### GET `/api/transaction/nextReceiptNo`

**Auth required:** Yes — Admin

**Description:** Generates and returns the next available receipt number based on the current highest receipt number in the database.

#### Request

No parameters.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "nextReceiptNo": "REC-2025-002"
  },
  "message": "Next receipt number generated"
}
```

---

### GET `/api/transaction`

**Auth required:** Yes — Admin

**Description:** Returns a paginated list of all payment transactions across all students, with optional filters.

#### Request

##### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `department` | string | No | `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `paymentMode` | string | No | `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `fromDate` | string | No | ISO date string — filters by `paidOn ≥ fromDate` |
| `toDate` | string | No | ISO date string — filters by `paidOn ≤ toDate` |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Results per page (default: 20) |

##### Example Request

```
GET /api/transaction?department=CSE&paymentMode=Cash&fromDate=2025-06-01&toDate=2025-06-30&page=1&limit=10
```

#### Validation

| Rule | Error |
|---|---|
| `department` not in allowed list | 400 |
| `paymentMode` not in allowed list | 400 |
| `fromDate` or `toDate` is not a valid date | 400 |
| `fromDate` is after `toDate` | 400 |
| `page` or `limit` is not a positive integer | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "rollNo": "25CS101",
        "studentName": "Arun Kumar",
        "department": "CSE",
        "receiptNo": "REC-2025-001",
        "paymentType": "Cash",
        "totalAmount": 162000,
        "paidOn": "2025-06-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  },
  "message": "Transactions fetched successfully"
}
```

---

### GET `/api/transaction/:rollNo`

**Auth required:** Yes — Admin

**Description:** Returns all payment transactions for a specific student, with optional date range and pagination filters.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rollNo` | string | Yes | Student roll number |

##### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fromDate` | string | No | ISO date string |
| `toDate` | string | No | ISO date string |
| `page` | number | No | Default: 1 |
| `limit` | number | No | Default: 20 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "rollNo": "25CS101",
    "transactions": [
      {
        "receiptNo": "REC-2025-001",
        "paymentType": "Cash",
        "paidOn": "2025-06-01T10:00:00.000Z",
        "totalAmount": 162000,
        "remarks": "First semester fee payment",
        "breakdowns": [
          {
            "academicYear": "2025-2026",
            "academic": { "semesterNumber": 1, "tuition": 75000, "exam": 1500, "erp": 500, "book": 1000, "lab": 2000 },
            "hostel": 70000,
            "transport": 12000,
            "total": 162000
          }
        ]
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  },
  "message": "Student transactions fetched successfully"
}
```

**404 — Student not found**
```json
{
  "success": false,
  "data": null,
  "message": "Student not found"
}
```

---

## 3. Edge Cases

- **`billingDate` flexible input:** Accepts `dd/mm/yyyy` (e.g. `15/08/2025`), ISO 8601 strings (e.g. `2025-08-15T00:00:00.000Z`), or a JavaScript Date object. If omitted, defaults to the current date/time at the moment of the request.
- **Overpayment prevention:**** Before saving, the service computes the remaining due for each fee component (`total - paid`). If any breakdown amount exceeds the remaining due, the entire transaction is rejected with a descriptive error.
- **Single receipt, multiple years:** A single `POST /pay` can include breakdowns for multiple `academicYear` entries, allowing payment of arrears and current year fees in one receipt.
- **`totalAmount` auto-calculation:** The sum of all breakdown totals in a receipt is computed automatically via a Mongoose pre-validate hook; do not include `totalAmount` in the request body.
- **Status transitions:** After a payment, each affected fee component's `status` is recalculated: `Unpaid → Partially Paid → Paid`.
- **Duplicate `receiptNo`:** Submitting a payment with an already-used receipt number returns a conflict error (`400`).
- **Payment type bank fields:** `bankName` and `bankLocation` are stored but not validated against a specific list — provide them for Cheque, DD, and NetBanking payments for audit purposes.
