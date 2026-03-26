# Refund API Documentation

Base path: `/api/refund`
Auth: All endpoints require `Authorization: Bearer <token>`. Role: `admin` or `superadmin`.

---

## POST `/api/refund/:rollNo` — Process a Refund

Deducts the specified amount from the student's paid balance for a given fee head and academic year. Creates an immutable refund record with a unique `RF-YYYY-NNNNN` receipt number.

### Headers
| Header | Type | Required | Notes |
|--------|------|----------|-------|
| `x-idempotency-key` | String | Yes | Unique string (e.g., UUID or timestamp) to strictly prevent duplicate identical requests. |

### Path Parameter
| Param | Type | Description |
|-------|------|-------------|
| `rollNo` | String | Student roll number (case-insensitive; stored in uppercase) |

### Request Body
```json
{
  "academicYear": "2024-2025",
  "semNumber": 3,
  "feeHead": "tuition",
  "refundAmount": 2000,
  "reason": "Duplicate payment",
  "isActive": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `academicYear` | String | Yes | Format: `YYYY-YYYY` |
| `feeHead` | String | Yes | One of: `tuition`, `exam`, `erp`, `book`, `lab`, `hostel`, `transport`, `excessAmount` |
| `semNumber` | Number | Conditional | Required for academic heads (`tuition`/`exam`/`erp`/`book`/`lab`); omit for `hostel`/`transport`/`excessAmount` |
| `refundAmount` | Number | Yes | Must be > 0 and ≤ current paid amount for that fee head |
| `reason` | String | Yes | Reason for refund (audit trail) |
| `isActive` | Boolean | No | Default: `true`. If `false`, the target ledger breakdown is marked inactive and refund amount is also reduced from its total/net demand |

### Success Response `201`
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "_id": "...",
    "rollNo": "23CS109",
    "academicYear": "2024-2025",
    "semesterNumber": 3,
    "feeHead": "tuition",
    "refundAmount": 2000,
    "reason": "Duplicate payment",
    "refundReceiptNo": "RF-2026-00001",
    "refundedBy": "...",
    "ledgerIsActive": true,
    "status": "completed",
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
  }
}
```

### Error Responses
| Status | Condition |
|--------|-----------|
| `400` | Missing/invalid fields |
| `400` | Missing `x-idempotency-key` header |
| `400` | `refundAmount` ≤ 0 |
| `400` | `refundAmount` > paid amount |
| `400` | `isActive=false` used for `excessAmount` |
| `400` | `paid` is 0 (nothing paid to refund) |
| `400` | `semNumber` missing for academic fee head |
| `400` | Semester does not belong to this academic year |
| `401` | Not authenticated |
| `401` | Not authorized as admin |
| `404` | Student fee tracking not found |
| `404` | Academic year not in student's ledger |
| `404` | Hostel/transport record not found for that year |

### Fee Head Routing
| `feeHead` | `semNumber` | Ledger path |
|-----------|-------------|-------------|
| `tuition`, `exam`, `erp`, `book`, `lab` | **Required** | `academic[odd/even][feeHead].paid` |
| `hostel` | Not used | `hostel.total.paid` |
| `transport` | Not used | `transport.total.paid` |
| `excessAmount` | Not used | `excessAmount` |

**Semester → ledger key mapping:**
Odd semesters (1, 3, 5, 7) → `academic.odd`
Even semesters (2, 4, 6, 8) → `academic.even`

### Inactivation behavior (`isActive=false`)

- Academic fee heads: component is marked inactive and refund amount is additionally applied as concession (so net total decreases).
- Transport/Hostel: ledger is marked inactive (`isActive=false`), `endDate` is set, `consumedAmount` stores consumed value from cancellation flow, and ledger status is set to `Refunded`.
- `excessAmount`: does not support `isActive=false`.

---

## GET `/api/refund/student/:rollNo` — Get Refunds by Student

Returns all refund records for a student, sorted newest first.

### Path Parameter
| Param | Type | Description |
|-------|------|-------------|
| `rollNo` | String | Student roll number |

### Success Response `200`
```json
{
  "success": true,
  "message": "Refunds fetched successfully",
  "data": [
    {
      "_id": "...",
      "rollNo": "23CS109",
      "academicYear": "2024-2025",
      "semesterNumber": 3,
      "feeHead": "tuition",
      "refundAmount": 2000,
      "reason": "Duplicate payment",
      "refundReceiptNo": "RF-2026-00001",
      "refundedBy": { "_id": "...", "name": "Admin User", "email": "admin@sece.ac.in" },
      "status": "completed",
      "createdAt": "2026-03-11T10:00:00.000Z"
    }
  ]
}
```

---

## GET `/api/refund/year/:academicYear` — Get Refunds by Academic Year

Returns paginated refund records for an academic year with optional filters.

### Path Parameter
| Param | Type | Description |
|-------|------|-------------|
| `academicYear` | String | e.g. `2024-2025` |

### Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| `feeHead` | String | Filter by fee head |
| `fromDate` | String | ISO date — start of date range (inclusive) |
| `toDate` | String | ISO date — end of date range (inclusive, set to 23:59:59) |
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Records per page (default: 20, max: 500) |

### Success Response `200`
```json
{
  "success": true,
  "message": "Refunds fetched successfully",
  "data": {
    "refunds": [...],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

## GET `/api/refund/report` — Admin Refund Report

Returns paginated refund records across all students with multi-dimensional filters.

### Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| `feeHead` | String | Filter by fee head |
| `fromDate` | String | ISO date — start of date range |
| `toDate` | String | ISO date — end of date range |
| `operator` | String | MongoDB ObjectId of the user who processed the refund |
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Records per page (default: 20, max: 500) |

### Success Response `200`
Same structure as Get Refunds by Academic Year.

---

## Concurrency Note

This module actively utilizes full ACID-compliant **MongoDB Transactions** (`session.startTransaction()`). Any operations deducting paid balances and tracking refunds are fully atomic. 
If concurrent refund requests are submitted for the same fee head, the idempotency-key check alongside the session-based lock and validations ensure your ledger bounds ($ paid >= refund $) will never be violated or drop below zero.

---

## Refund Receipt Number Format

Refund receipts follow the format `RF-{YEAR}-{SEQUENCE}`:
```
RF-2026-00001
RF-2026-00002
```
The sequence resets at the start of each calendar year (e.g., `RF-2027-00001`).
