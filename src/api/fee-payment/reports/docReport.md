# Reports API Documentation

This document provides a clear, concise guide to the Reports API endpoints, focusing on available query parameters and complete example responses.

**Base Route:** `/api/reports`

---

## 1. Individual Fee Report

Retrieves a detailed, row-by-row fee payment history for a specific student. It automatically dynamically calculates their total demand, approved concessions, and current balance matched against each payment they have made.

**Endpoint:** `GET /individual`  
**Authentication & Testing Header:** `Authorization: Bearer <token>` (Admin/Superadmin only)

### Query Parameters

| Parameter  | Type   | Required | Description                                                                 | Default      |
| :--------- | :----- | :------- | :-------------------------------------------------------------------------- | :----------- |
| `rollNo`   | String | **Yes**  | The exact roll number of the student (e.g., `25CS101`).                     | -            |
| `semester` | String | No       | Filter the transactions by semester cycle. Allowed values: `odd` or `even`. | Both cycles  |
| `fromDate` | Date   | No       | Start boundary for fetching transactions (Format: `YYYY-MM-DD`).            | Today's Date |
| `toDate`   | Date   | No       | End boundary for fetching transactions (Format: `YYYY-MM-DD`).              | Today's Date |

### Example Response Body

```json
{
  "success": true,
  "data": {
    "student": {
      "rollNo": "25CS101",
      "studentName": "Arun Prakash",
      "studentPhoto": "https://example.com/student-photo.jpg",
      "registerNumber": "713521104001",
      "departmentName": "CSE",
      "yearStudying": 1,
      "section": "A"
    },
    "rows": [
      {
        "receiptNo": "REC123456",
        "feeHead": "Academic Fees",
        "subHead": "Tuition Fees",
        "demand": 40000,
        "concession": 10000,
        "paid": 20000,
        "balance": 10000,
        "paymentDate": "2026-03-09T14:30:06.877Z",
        "paymentMode": "Cash"
      },
      {
        "receiptNo": "REC123456",
        "feeHead": "Transport Fees",
        "subHead": "-",
        "demand": 15000,
        "concession": 0,
        "paid": 15000,
        "balance": 0,
        "paymentDate": "2026-03-09T14:30:06.877Z",
        "paymentMode": "Cash"
      }
    ]
  }
}
```

---

## 2. Datewise Fee Report

Retrieves a paginated, system-wide list of every individual fee transaction across all students that occurred within a defined date range. This is designed for auditing daily or monthly fiscal intake collections.

**Endpoint:** `GET /datewise`  
**Authentication & Testing Header:** `Authorization: Bearer <token>` (Admin/Superadmin only)

### Query Parameters

| Parameter      | Type    | Required | Description                                                                              | Default      |
| :------------- | :------ | :------- | :--------------------------------------------------------------------------------------- | :----------- |
| `fromDate`     | Date    | No       | Start boundary for transactions (Format: `YYYY-MM-DD`).                                  | Today's Date |
| `toDate`       | Date    | No       | End boundary for transactions (Format: `YYYY-MM-DD`).                                    | Today's Date |
| `academicYear` | String  | No       | Filter records strictly to a specific batch/academic year context (e.g., `2025-2026`).   | -            |
| `paymentMode`  | String  | No       | Filter by payment instrument type. Example values: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD`, `excessAmount`.  | -            |
| `feeHead`      | String  | No       | Filter by base exact core slug. Options: `tuition`, `exam`, `erp`, `hostel`, `transport` | -            |
| `page`         | Integer | No       | The pagination page number to retrieve.                                                  | 1            |
| `limit`        | Integer | No       | The pagination threshold sizing per page.                                                | 20           |

### Example Response Body

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "student": {
          "studentName": "Arun Prakash",
          "studentPhoto": "https://example.com/student-photo.jpg",
          "department": "CSE",
          "year": 1
        },
        "rollNo": "25CS101",
        "semPeriod": "Odd Sem",
        "feeHead": "Academic Fees",
        "subHead": "Tuition Fees",
        "amount": 20000,
        "date": "2026-03-09T14:35:00.000Z",
        "paymentMode": "Cash",
        "bank": "Indian Bank",
        "receiptNo": "REC123456"
      },
      {
        "student": {
          "studentName": "Kavitha Sharma",
          "studentPhoto": "",
          "department": "IT",
          "year": 2
        },
        "rollNo": "24IT201",
        "semPeriod": "Even Sem",
        "feeHead": "Hostel Fees",
        "subHead": "-",
        "amount": 35000,
        "date": "2026-03-09T14:40:00.000Z",
        "paymentMode": "UPI",
        "bank": "HDFC",
        "receiptNo": "REC123457"
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 3. Classwise Fee Report

Retrieves a detailed, row-by-row fee status report suitable for class-level or department-level tracking. Each row represents a specific fee head for a student and its current payment status.

**Endpoint:** `GET /classwise`  
**Authentication & Testing Header:** `Authorization: Bearer <token>` (Admin/Superadmin only)

### Query Parameters

| Parameter      | Type    | Required | Description                                                                              | Default      |
| :------------- | :------ | :------- | :--------------------------------------------------------------------------------------- | :----------- |
| `academicYear` | String  | No       | Filter records to a specific academic year (e.g., `2025-2026`).                          | -            |
| `department`   | String  | No       | Filter by department abbreviation (e.g., `CSE`, `IT`).                                   | -            |
| `studeingyear` | Integer | No       | Filter by the student's currently studying year (e.g., `1`, `2`, `3`, `4`).              | -            |
| `semNo`        | Integer | No       | Filter by exactly this numerical semester (e.g., `3`). Applies to academic fees only.    | -            |
| `section`      | String  | No       | Filter by section (e.g., `A`, `B`).                                                      | -            |
| `status`       | String  | No       | Filter explicitly by fee standing. Allowed values: `paid`, `partial`, `unpaid`.          | -            |

### Example Response Body

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "studentName": "Arun Prakash",
        "rollNo": "25CS101",
        "section": "A",
        "department": "CSE",
        "year": 1,
        "academicYear": "2025-2026",
        "semNo": 1,
        "feeHead": "Academic Fees",
        "subHead": "Tuition Fees",
        "status": "partial",
        "total": 40000,
        "paid": 20000,
        "concession": 0,
        "unpaid": 20000
      },
      {
        "studentName": "Arun Prakash",
        "rollNo": "25CS101",
        "section": "A",
        "department": "CSE",
        "year": 1,
        "academicYear": "2025-2026",
        "semNo": "-",
        "feeHead": "Hostel Fees",
        "subHead": "-",
        "status": "unpaid",
        "total": 50000,
        "paid": 0,
        "concession": 0,
        "unpaid": 50000
      }
    ]
  },
  "message": "Class wise fee report fetched successfully"
}
```

