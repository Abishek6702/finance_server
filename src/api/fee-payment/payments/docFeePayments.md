# Transaction API Documentation

Base path: `/api/feePayment`
All routes require `Authorization: Bearer <token>` (admin role).

---

## Table of Contents

1. [POST /pay — Record a Payment](#1-post-pay--record-a-payment)
2. [GET / — Get All Transactions](#2-get---get-all-transactions)
3. [GET /:rollNo — Get Student Transactions](#3-get-rollno--get-student-transactions)
4. [GET /recent — Get Recent Transactions](#4-get-recent--get-recent-transactions)
5. [GET /bill/:receiptNo — Get Bill by Receipt Number](#5-get-billreceiptno--get-bill-by-receipt-number)
6. [Error Reference](#6-error-reference)

---

## 1. POST /pay — Record a Payment

Records a fee payment for a student across one or more academic years and fee categories.

**`POST /api/feePayment/pay`**

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
  "paymentType": "Cash | Card | UPI | NetBanking | Cheque | DD | excessAmount",
  "bankName":    "string (optional)",
  "bankLocation":"string (optional)",
  "billingDate": "string (optional) — dd/mm/yyyy or ISO 8601; defaults to today",
  "excessAmount": "number (optional) — adds to student's excess balance",
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
| `paymentType` | Required. Must be one of: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD`, `excessAmount` |
| `bankName` | Optional string |
| `bankLocation` | Optional string |
| `billingDate` | Optional. Accepted formats: `dd/mm/yyyy` or ISO 8601. Defaults to current date |
| `excessAmount` | Optional. Non-negative number, max 2 decimal places. When provided and > 0, it is added to the student's excess balance |
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
- If `excessAmount` is provided and > 0, it is added to `enrollment.excessAmount` and `enrollment.isExcessAmountTrue` is set to `true`.
- For `paymentType=excessAmount`, the student's available excess balance (current balance + any `excessAmount` provided in the request) must be **greater than or equal to** the total payable. On success, the student's `enrollment.excessAmount` is reduced by the paid total and `enrollment.isExcessAmountTrue` is updated based on whether the remaining balance is > 0.
- Receipt number is auto-generated in format `REC-YYYYMMDD-NNN` (e.g., `REC-20260304-001`).
- `studentTransactionDoc` is created lazily on first payment.

---

### Request Body Example

```json
{
  "rollNo": "22CSE001",
  "paymentType": "UPI",
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
    
        "receiptNo": "REC-20260304-001", 
  }
}
```

---

## 2. GET / — Get All Transactions

Returns all transactions across all students, with optional filters. Can be paginated.

**`GET /api/feePayment`**

### Headers

| Key           | Value            | Required |
|---------------|------------------|----------|
| Authorization | `Bearer <token>` | Yes      |

---

### Query Parameters

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `department` | string | No       | Filter by department. One of: `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `paymentMode`| string | No       | Filter by payment type. One of: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD`, `excessAmount` |
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
GET /api/feePayment?department=CSE&paymentMode=UPI&fromDate=2026-01-01&toDate=2026-03-04&page=1&limit=10
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
          "totalAmount": 75000,
          "breakdowns": [
            {
              "_id": "664abc000000000000000001",
              "academicYear": "2022-2023",
              "semesterNumber": 1,
              "feeHeads": [
                { "_id": "664abc000000000000000011", "type": "tuition", "fee": 45000 },
                { "_id": "664abc000000000000000012", "type": "exam",    "fee": 1500  },
                { "_id": "664abc000000000000000013", "type": "erp",     "fee": 500   },
                { "_id": "664abc000000000000000014", "type": "book",    "fee": 1000  },
                { "_id": "664abc000000000000000015", "type": "lab",     "fee": 2000  },
                { "_id": "664abc000000000000000021", "type": "hostel",  "fee": 25000 }
              ],
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

**`GET /api/feePayment/:rollNo`**

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
GET /api/feePayment/22CSE001?fromDate=2026-01-01&limit=5&page=1
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



### Error Responses

| HTTP | Scenario | Message |
|------|----------|---------|
| `401` | No / invalid token | _(auth error)_ |
| `403` | Not an admin | _(auth error)_ |

---

## 4. GET /recent — Get Recent feePayment

Returns an unpacked list of individual fee head feePayment across all students. This restructures the root feePayment so each individual fee component (e.g., tuition, lab, hostel) appears as its own transaction row. Useful for dashboards and generating granular reports. Can be paginated and filtered.

**`GET /api/feePayment/recent`**

### Headers

| Key           | Value            | Required |
|---------------|------------------|----------|
| Authorization | `Bearer <token>` | Yes      |

---

### Query Parameters

| Parameter      | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `department`   | string | No       | Filter by department. One of: `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `paymentMode`  | string | No       | Filter by payment type. One of: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD`, `excessAmount` |
| `feeHead`      | string | No       | Filter by fee category. One of: `tuition`, `exam`, `erp`, `book`, `lab`, `hostel`, `transport` |
| `yearStudying` | string | No       | Filter by student's current year of study (`1`, `2`, `3`, `4`) |
| `rollNo`       | string | No       | Filter by exact student roll number (case-insensitive — converted to uppercase) |
| `fromDate`     | string | No       | Start of date range based on `transaction.paidOn` (inclusive) |
| `toDate`       | string | No       | End of date range based on `transaction.paidOn` (inclusive, up to 23:59:59) |
| `page`         | integer| No       | Page number (≥ 1). Default: `1`. Only with `limit` |
| `limit`        | integer| No       | Results per page (≥ 1, max 500). When omitted, all results are returned un-paginated |

### Validation Rules

| Parameter | Rules |
|---|---|
| `department` | Must be one of the valid department codes when provided |
| `paymentMode` | Must be one of the valid payment types when provided |
| `feeHead` | Must be one of the valid fee head categories when provided |
| `yearStudying` | Must be an integer between 1 and 4 |
| `rollNo` | Optional string; automatically uppercased before matching |
| `fromDate` / `toDate` | Must be parseable dates; `fromDate` cannot be after `toDate` |
| `page` / `limit` | Must be positive integers |

### Request Example

```
GET /api/feePayment/recent?department=CSE&feeHead=tuition&page=1&limit=20
GET /api/feePayment/recent?rollNo=22CSE001&limit=10
```

---

### Success Response — `200 OK` (with `limit`)

```json
{
  "success": true,
  "message": "feePayment fetched successfully",
  "data": {
    "transactions": [
      {
        "_id": "664abc000000000000000011",
        "receiptNo": "REC-20260304-001",
        "student": {
          "name": "Arjun Kumar",
          "rollNo": "22CSE001",
          "department": "CSE",
          "yearStudying": 3
        },
        "feeHead": "tuition",
        "amount": 45000,
        "paymentMode": "UPI",
        "date": "2026-03-04T10:23:45.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
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
      "total": 12,
      "page": 1,
      "limit": 12,
      "totalPages": 1
    }
  }
}
```

---

## 5. GET /bill/:receiptNo — Get Bill by Receipt Number

Returns a formatted bill for a given receipt number.

**`GET /api/feePayment/bill/:receiptNo`**

### Headers

| Key           | Value            | Required |
|---------------|------------------|----------|
| Authorization | `Bearer <token>` | Yes      |

### Path Parameter

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `receiptNo` | string | Yes      | Receipt number (e.g. `REC-20260312-001`) |

### Request Example

```
GET /api/feePayment/bill/REC-20260312-001
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Bill fetched successfully",
  "data": {
    "receiptNo": "REC-20260312-001",
    "date": "12-03-2026",
    "studentName": "AASTHA GUPTA",
    "rollNo": "24CS002",
    "year": "2",
    "section": "A",
    "department": "CSE",
    "educationType": "B.E",
    "studentCurrentSemNumber": "3",
    "paidForSemNumber": "3",
    "paidForAcadamicYear": "2025-2026",
    "breakdowns": {
      "Tuition Fee": 40000,
      "Exam Fee": 2000,
      "ERP Fee": 500,
      "Book Fee": 1000,
      "Lab Fee": 1500
    },
    "cashAmount": 0,
    "bankAmount": 45000,
    "totalAmount": 45000,
    "amountInWords": "Forty Five Thousand Only",
    "bankName": "Union Bank of India",
    "bankLocation": "Kinathukadavu, Coimbatore"
  }
}
```

### Response Fields

| Field                    | Type           | Description |
|--------------------------|----------------|-------------|
| `receiptNo`              | string         | Auto-generated receipt number |
| `date`                   | string         | Billing date in `DD-MM-YYYY` format |
| `studentName`            | string         | Full name of the student |
| `rollNo`                 | string         | Student's roll number |
| `year`                   | string         | Current year of study (1–4) |
| `section`                | string         | Section (e.g. `A`) |
| `department`             | string         | Department code (e.g. `CSE`) |
| `educationType`          | string         | Degree label: `B.E`, `B.Tech`, `M.E`, or `M.Tech` |
| `studentCurrentSemNumber`| string         | Student's current semester |
| `paidForSemNumber`       | string \| null | Semester this payment covers (null for hostel/transport-only receipts) |
| `paidForAcadamicYear`    | string \| null | Academic year this payment covers |
| `breakdowns`             | object         | Flat map of fee type label → amount paid in this receipt |
| `cashAmount`             | number         | Amount paid in cash (> 0 only when `paymentType` is `Cash`) |
| `bankAmount`             | number         | Amount paid via bank (> 0 for all non-Cash payment types) |
| `totalAmount`            | number         | Total amount of this receipt |
| `amountInWords`          | string         | `totalAmount` spelled out with "Only" suffix |
| `bankName`               | string \| null | Bank name (if provided) |
| `bankLocation`           | string \| null | Bank location (if provided) |

### Error Responses

| HTTP  | Scenario                      | Message                         |
|-------|-------------------------------|---------------------------------|
| `400` | `receiptNo` param is empty    | `receiptNo path parameter is required` |
| `404` | Receipt number not found      | `Receipt not found`             |
| `401` | No / invalid token            | _(auth error)_                  |
| `403` | Not an admin                  | _(auth error)_                  |

---

## 6. Error Reference

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
| Invalid `paymentMode` query param | `paymentMode must be one of: Cash, Card, UPI, NetBanking, Cheque, DD, excessAmount` |
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
| Receipt number not found | `Receipt not found` |
| Student record missing for a receipt | `Associated student not found` |

### Auth Errors

| Status | Message |
|---|---|
| `401 Unauthorized` | Token missing or invalid |
| `403 Forbidden` | User is not an admin |
