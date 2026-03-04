# Transaction API Documentation

Base path: `/api/transactions`
All routes require `Authorization: Bearer <token>` (admin role).

---

## Table of Contents

1. [POST /pay — Record a Payment](#1-post-pay--record-a-payment)
2. [GET / — Get All Transactions](#2-get---get-all-transactions)
3. [GET /:rollNo — Get Student Transactions](#3-get-rollno--get-student-transactions)
4. [Error Reference](#4-error-reference)

---

## 1. POST /pay — Record a Payment

Records a fee payment for a student across one or more academic years and fee categories.

**`POST /api/transactions/pay`**

### Headers

| Key             | Value                  | Required |
|-----------------|------------------------|----------|
| Authorization   | `Bearer <token>`        | Yes      |
| Content-Type    | `application/json`      | Yes      |

---

### Request Body

```json
{
  "rollNo":      "string",
  "paymentType": "Cash | Card | UPI | NetBanking | Cheque | DD",
  "bankName":    "string (optional)",
  "bankLocation":"string (optional)",
  "billingDate": "string (optional) — dd/mm/yyyy or ISO 8601; defaults to today",
  "remarks":     "string (optional)",
  "breakdowns": [
    {
      "academicYear": "string — format YYYY-YYYY",
      "academic": {
        "semesterNumber": "integer 1–8 (required when any academic fee > 0)",
        "tuition":        "number ≥ 0, ≤ 2 decimal places (optional, default 0)",
        "exam":           "number ≥ 0, ≤ 2 decimal places (optional, default 0)",
        "erp":            "number ≥ 0, ≤ 2 decimal places (optional, default 0)",
        "book":           "number ≥ 0, ≤ 2 decimal places (optional, default 0)",
        "lab":            "number ≥ 0, ≤ 2 decimal places (optional, default 0)"
      },
      "hostel":    "number ≥ 0, ≤ 2 decimal places (optional, default 0)",
      "transport": "number ≥ 0, ≤ 2 decimal places (optional, default 0)"
    }
  ]
}
```

### Field Validation Rules

| Field | Rules |
|---|---|
| `rollNo` | Required |
| `paymentType` | Required. Must be one of: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `bankName` | Optional string |
| `bankLocation` | Optional string |
| `billingDate` | Optional. Accepted formats: `dd/mm/yyyy` or ISO 8601. Defaults to current date |
| `remarks` | Optional string |
| `breakdowns` | Required. Non-empty array of breakdown objects |
| `breakdowns[].academicYear` | Required. Format: `YYYY-YYYY` (e.g., `2023-2024`) |
| `breakdowns[].academic.semesterNumber` | Required when any academic fee amount > 0. Integer 1–8 |
| `breakdowns[].academic.*` (tuition, exam, erp, book, lab) | Optional. Non-negative number, max 2 decimal places, max 1 000 000 000 000 |
| `breakdowns[].hostel` | Optional. Same money rules as above |
| `breakdowns[].transport` | Optional. Same money rules as above |
| Total payment | Must be greater than 0 |
| Each amount | Must not exceed the remaining due (total − already paid) for that component |
| Duplicate breakdowns | Same year+semester, or same year for hostel/transport in one request is rejected |

### Business Logic Constraints

- Each fee component amount is validated against the **remaining due** in `StudentFeeTracking`; overpayment is rejected.
- The aggregate academic payment per year is also cross-checked against the **net academic total** (post-concession) to prevent overpayment across semesters.
- Receipt number is auto-generated in format `REC-YYYYMMDD-NNN` (e.g., `REC-20260304-001`).
- `studentTransactionDoc` is created lazily on first payment.

---

### Request Body Example

```json
{
  "rollNo": "22CSE001",
  "paymentType": "UPI",
  "remarks": "Semester 1 fee payment",
  "billingDate": "04/03/2026",
  "breakdowns": [
    {
      "academicYear": "2022-2023",
      "academic": {
        "semesterNumber": 1,
        "tuition": 45000,
        "exam": 1500,
        "erp": 500,
        "book": 1000,
        "lab": 2000
      }
    },
    {
      "academicYear": "2022-2023",
      "hostel": 25000,
      "transport": 0
    }
  ]
}
```

---

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "student": "665f1a2b3c4d5e6f7a8b9c01",
    "rollNo": "22CSE001",
    "transactions": [
      {
        "receiptNo": "REC-20260304-001",
        "paymentType": "UPI",
        "bankName": null,
        "bankLocation": null,
        "billingDate": "2026-03-04T00:00:00.000Z",
        "paidOn": "2026-03-04T10:23:45.000Z",
        "remarks": "Semester 1 fee payment",
        "totalAmount": 75000,
        "breakdowns": [
          {
            "academicYear": "2022-2023",
            "academic": {
              "semesterNumber": 1,
              "tuition": 45000,
              "exam": 1500,
              "erp": 500,
              "book": 1000,
              "lab": 2000
            },
            "hostel": 0,
            "transport": 0,
            "total": 50000
          },
          {
            "academicYear": "2022-2023",
            "academic": {
              "semesterNumber": null,
              "tuition": 0,
              "exam": 0,
              "erp": 0,
              "book": 0,
              "lab": 0
            },
            "hostel": 25000,
            "transport": 0,
            "total": 25000
          }
        ],
        "createdAt": "2026-03-04T10:23:45.000Z",
        "updatedAt": "2026-03-04T10:23:45.000Z"
      }
    ],
    "createdAt": "2026-03-04T10:23:45.000Z",
    "updatedAt": "2026-03-04T10:23:45.000Z"
  }
}
```

---

## 2. GET / — Get All Transactions

Returns all transactions across all students, with optional filters. Can be paginated.

**`GET /api/transactions`**

### Headers

| Key           | Value            | Required |
|---------------|------------------|----------|
| Authorization | `Bearer <token>` | Yes      |

---

### Query Parameters

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `department` | string | No       | Filter by department. One of: `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `paymentMode`| string | No       | Filter by payment type. One of: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `fromDate`   | string | No       | Start of date range (inclusive). Any valid date string |
| `toDate`     | string | No       | End of date range (inclusive, up to 23:59:59). Any valid date string |
| `page`       | integer| No       | Page number (≥ 1). Default: `1`. Only with `limit` |
| `limit`      | integer| No       | Results per page (≥ 1, max 500). When omitted, all results are returned un-paginated |

### Validation Rules

| Parameter | Rules |
|---|---|
| `department` | Must be one of the valid department codes when provided |
| `paymentMode` | Must be one of the valid payment types when provided |
| `fromDate` / `toDate` | Must be parseable dates; `fromDate` cannot be after `toDate` |
| `page` / `limit` | Must be positive integers |

### Request Example

```
GET /api/transactions?department=CSE&paymentMode=UPI&fromDate=2026-01-01&toDate=2026-03-04&page=1&limit=10
```

---

### Success Response — `200 OK` (with `limit`)

```json
{
  "success": true,
  "message": "Transactions fetched successfully",
  "data": {
    "transactions": [
      {
        "student": {
          "_id": "665f1a2b3c4d5e6f7a8b9c01",
          "personal": {
            "rollNo": "22CSE001",
            "studentName": "Arjun Kumar",
            "studentPhoto": "https://cdn.example.com/photos/22cse001.jpg"
          },
          "academic": {
            "departmentName": "CSE",
            "year": 3,
            "batch": "2022-2026"
          },
          "contact": {
            "email": "arjun@example.com",
            "phone": "9876543210"
          }
        },
        "transaction": {
          "receiptNo": "REC-20260304-001",
          "paymentType": "UPI",
          "bankName": null,
          "bankLocation": null,
          "billingDate": "2026-03-04T00:00:00.000Z",
          "paidOn": "2026-03-04T10:23:45.000Z",
          "remarks": "Semester 1 fee payment",
          "totalAmount": 75000,
          "breakdowns": [
            {
              "academicYear": "2022-2023",
              "academic": {
                "semesterNumber": 1,
                "tuition": 45000,
                "exam": 1500,
                "erp": 500,
                "book": 1000,
                "lab": 2000
              },
              "hostel": 25000,
              "transport": 0,
              "total": 75000
            }
          ]
        }
      }
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

### Success Response — `200 OK` (without `limit`, all results)

```json
{
  "success": true,
  "message": "Transactions fetched successfully",
  "data": {
    "transactions": [ "...all matching transaction objects..." ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 42,
      "totalPages": 1
    }
  }
}
```

---

## 3. GET /:rollNo — Get Student Transactions

Returns all transactions for a specific student.

**`GET /api/transactions/:rollNo`**

### Headers

| Key           | Value            | Required |
|---------------|------------------|----------|
| Authorization | `Bearer <token>` | Yes      |

---

### Path Parameter

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| `rollNo`  | string | Yes      | Student's roll number |

### Query Parameters

| Parameter  | Type    | Required | Description |
|------------|---------|----------|-------------|
| `fromDate` | string  | No       | Start of date range (inclusive) |
| `toDate`   | string  | No       | End of date range (inclusive, up to 23:59:59) |
| `page`     | integer | No       | Page number (≥ 1). Default: `1` |
| `limit`    | integer | No       | Results per page (≥ 1, max 500). When omitted, all results are returned |

### Validation Rules

| Parameter | Rules |
|---|---|
| `fromDate` / `toDate` | Must be parseable dates; `fromDate` cannot be after `toDate` |
| `page` / `limit` | Must be positive integers |

### Request Example

```
GET /api/transactions/22CSE001?fromDate=2026-01-01&limit=5&page=1
```

---

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Student transactions fetched successfully",
  "data": {
    "student": {
      "_id": "665f1a2b3c4d5e6f7a8b9c01",
      "personal": {
        "rollNo": "22CSE001",
        "studentName": "Arjun Kumar",
        "studentPhoto": "https://cdn.example.com/photos/22cse001.jpg"
      },
      "academic": {
        "departmentName": "CSE",
        "year": 3,
        "batch": "2022-2026"
      },
      "contact": {
        "email": "arjun@example.com",
        "phone": "9876543210"
      }
    },
    "transactions": [
      {
        "receiptNo": "REC-20260304-001",
        "paymentType": "UPI",
        "bankName": null,
        "bankLocation": null,
        "billingDate": "2026-03-04T00:00:00.000Z",
        "paidOn": "2026-03-04T10:23:45.000Z",
        "remarks": "Semester 1 fee payment",
        "totalAmount": 75000,
        "breakdowns": [
          {
            "academicYear": "2022-2023",
            "academic": {
              "semesterNumber": 1,
              "tuition": 45000,
              "exam": 1500,
              "erp": 500,
              "book": 1000,
              "lab": 2000
            },
            "hostel": 25000,
            "transport": 0,
            "total": 75000
          }
        ]
      },
      {
        "receiptNo": "REC-20260210-003",
        "paymentType": "Cheque",
        "bankName": "SBI",
        "bankLocation": "Chennai",
        "billingDate": "2026-02-10T00:00:00.000Z",
        "paidOn": "2026-02-10T09:00:00.000Z",
        "remarks": null,
        "totalAmount": 15000,
        "breakdowns": [
          {
            "academicYear": "2022-2023",
            "academic": {
              "semesterNumber": 2,
              "tuition": 15000,
              "exam": 0,
              "erp": 0,
              "book": 0,
              "lab": 0
            },
            "hostel": 0,
            "transport": 0,
            "total": 15000
          }
        ]
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 5,
      "totalPages": 1
    }
  }
}
```

---

## 4. Error Reference

All error responses follow the structure:

```json
{
  "success": false,
  "message": "<error message>"
}
```

### Validation Errors — `400 Bad Request`

| Scenario | Message |
|---|---|
| `rollNo` missing | `rollNo is required` |
| Invalid or missing `paymentType` | `Valid paymentType is required` |
| `breakdowns` missing or empty | `breakdowns array is required` |
| A breakdown entry is not an object | `Each breakdown must be an object` |
| Invalid `academicYear` format | `Valid breakdown.academicYear is required` |
| `semesterNumber` out of range | `academic.semesterNumber must be an integer between 1 and 8` |
| Invalid money value (negative or > 2 dp) | `academic.<field> must be a non-negative number with up to 2 decimals` |
| `semesterNumber` missing when academic fees > 0 | `academic.semesterNumber is required when academic fee amounts are provided` |
| Invalid `hostel` value | `hostel must be a non-negative number with up to 2 decimals` |
| Invalid `transport` value | `transport must be a non-negative number with up to 2 decimals` |
| Duplicate semester in same request | `Duplicate breakdown for semester <N> in <YYYY-YYYY>. Combine amounts into a single breakdown.` |
| Duplicate hostel for same year in one request | `Duplicate hostel payment for <YYYY-YYYY>. Combine amounts into a single breakdown.` |
| Duplicate transport for same year in one request | `Duplicate transport payment for <YYYY-YYYY>. Combine amounts into a single breakdown.` |
| Payment exceeds remaining academic component due | `<field> payment ₹<amount> exceeds remaining concession-adjusted due ₹<remaining> for Semester <N> (<YYYY-YYYY>)` |
| Academic payment exceeds net year total | `Academic payment ₹<amount> exceeds net remaining due ₹<remaining> for <YYYY-YYYY> (after concessions)` |
| Hostel payment exceeds remaining due | `Hostel payment ₹<amount> exceeds remaining concession-adjusted due ₹<remaining> for <YYYY-YYYY>` |
| Transport payment exceeds remaining due | `Transport payment ₹<amount> exceeds remaining concession-adjusted due ₹<remaining> for <YYYY-YYYY>` |
| Total payment is zero | `Total payment amount must be greater than 0` |
| Invalid `department` query param | `department must be one of: CSE, IT, AIML, AIDS, ECE, EEE, MECH, CIVIL` |
| Invalid `paymentMode` query param | `paymentMode must be one of: Cash, Card, UPI, NetBanking, Cheque, DD` |
| Invalid `fromDate` / `toDate` | `fromDate must be a valid date` / `toDate must be a valid date` |
| `fromDate` after `toDate` | `fromDate cannot be after toDate` |
| `page` not a positive integer | `page must be a positive integer` |
| `limit` not a positive integer | `limit must be a positive integer` |

### Resource Errors — `404 Not Found`

| Scenario | Message |
|---|---|
| No fee tracking found for `rollNo` | `Fee tracking not found for this student` |
| `academicYear` not in student's tracking | `Academic year <YYYY-YYYY> not found in fee tracking` |
| Semester slot not in tracking for that year | `Semester <N> not found in tracking for <YYYY-YYYY>` |
| Semester number doesn't match the slot in that year | `Semester <N> does not belong to academic year <YYYY-YYYY>. This year has semester <M> in the <odd/even> slot.` |
| No hostel record for that year | `No hostel fee record found for <YYYY-YYYY>` |
| No transport record for that year | `No transport fee record found for <YYYY-YYYY>` |
| Student not found (GET by rollNo) | `Student not found` |

### Auth Errors

| Status | Message |
|---|---|
| `401 Unauthorized` | Token missing or invalid |
| `403 Forbidden` | User is not an admin |
