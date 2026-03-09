# Receipt Recall Module

Allows admins to **instantly reverse specific fee heads** from a payment receipt. No approval workflow — recall is immediate with a reason.

- Targets individual fee heads by `_id` (each `feeHead` entry inside a `breakdown` has a unique ObjectId).
- Partial recall removes only the targeted fee heads; the breakdown and receipt remain if other fee heads exist.
- Full recall (all fee heads gone) removes empty breakdowns; if all breakdowns gone, removes the entire receipt.
- Duplicate recall of the same fee head is blocked (checked via recall history).

**Couples with:** `StudentTransaction` (feeHead/breakdown/receipt removal), `StudentFeeTracking` (paid reversal), `ActivityLog` (audit).

---

## POST `/api/receiptRecall`

**Auth:** Admin | **Instant recall — no approval needed**

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `receiptNo` | string | ✓ | Receipt containing the fee heads |
| `rollNo` | string | ✓ | Student roll number |
| `reason` | string | ✓ | Why the recall is needed |
| `feeHeadIds` | string[] | ✓ | ObjectIds of individual fee heads to recall (deduplicated automatically) |

```json
{
  "receiptNo": "REC-20260303-001",
  "rollNo": "25CS101",
  "reason": "Wrong semester selected",
  "feeHeadIds": ["664abc123def456789000011"]
}
```

### Response `201`

```json
{
  "success": true,
  "message": "Breakdown(s) recalled successfully",
  "data": {
    "_id": "67c9a1b2e4f5a60012345678",
    "receiptId": "67b8f0a1c3d2e50011223344",
    "receiptNo": "REC-20260303-001",
    "rollNo": "25CS101",
    "reason": "Wrong semester selected",
    "feeHeadIds": ["664abc123def456789000011"],
    "feeHeadSnapshots": [
      {
        "_id": "664abc123def456789000011",
        "type": "exam",
        "fee": 1500,
        "academicYear": "2025-2026",
        "semesterNumber": 1
      }
    ],
    "studentInfo": {
      "studentName": "John Doe",
      "studentPhoto": "photo.jpg",
      "departmentName": "CSE",
      "section": "A",
      "currentAcademicYear": "2025-2026",
      "yearStudying": 1,
      "currentSemesterNumber": 1
    },
    "recalledBy": "65f1a2b3c4d5e60011223344",
    "createdAt": "2026-03-07T10:30:00.000Z",
    "updatedAt": "2026-03-07T10:30:00.000Z"
  }
}
```

> `feeHeadSnapshots` is a frozen copy of each recalled fee head (plus its parent breakdown context) at the moment of recall, preserved for audit purposes.

### Errors

| Status | Condition |
|---|---|
| `400` | Missing/invalid fields or invalid ObjectId in `feeHeadIds` |
| `404` | Student has no transactions, receipt not found, or fee head not found in receipt |
| `409` | One or more fee heads have already been recalled for this receipt |

### What happens on recall

1. Reverses `paid` in fee tracking for each recalled fee head (by type: tuition/exam/erp/book/lab/hostel/transport) and recalculates status at every level.
2. Removes recalled fee heads from the breakdown's `feeHeads[]`.
3. If a breakdown has no remaining fee heads → removes that breakdown.
4. If no breakdowns remain in the receipt → removes the entire receipt.
5. Otherwise recalculates `totalAmount` for remaining breakdowns and receipt.

---

## GET `/api/receiptRecall`

**Auth:** Admin (superadmin also passes via admin guard)

### Query Parameters

| Param | Type | Description |
|---|---|---|
| `rollNo` | string | Filter by student |
| `receiptNo` | string | Filter by receipt |
| `page` | number | Page number (default: `1`) |
| `limit` | number | Results per page (omit to return all) |

### Response `200`

```json
{
  "success": true,
  "message": "Recall records fetched successfully",
  "data": {
    "records": [
      {
        "_id": "67c9a1b2e4f5a60012345678",
        "receiptId": "67b8f0a1c3d2e50011223344",
        "receiptNo": "REC-20260303-001",
        "rollNo": "25CS101",
        "reason": "Wrong semester selected",
        "feeHeadIds": ["664abc123def456789000011"],
        "feeHeadSnapshots": [
          {
            "_id": "664abc123def456789000011",
            "type": "exam",
            "fee": 1500,
            "academicYear": "2025-2026",
            "semesterNumber": 1
          }
        ],
        "studentInfo": {
          "studentName": "John Doe",
          "studentPhoto": "photo.jpg",
          "departmentName": "CSE",
          "section": "A",
          "currentAcademicYear": "2025-2026",
          "yearStudying": 1,
          "currentSemesterNumber": 1
        },
        "recalledBy": "65f1a2b3c4d5e60011223344",
        "createdAt": "2026-03-07T10:30:00.000Z",
        "updatedAt": "2026-03-07T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

> When `limit` is omitted, all matching records are returned and `pagination.totalPages` will be `1`.
