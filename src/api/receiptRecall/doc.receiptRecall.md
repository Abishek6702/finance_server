# Receipt Recall Module

Allows admins to **instantly reverse specific breakdowns** from a payment receipt. No approval workflow — recall is immediate with a reason.

- Targets individual breakdowns by `_id` (each breakdown in a receipt has a unique ObjectId).
- Partial recall keeps remaining breakdowns intact; full recall removes the entire receipt.
- Duplicate recall of the same breakdown is blocked (checked via recall history).

**Couples with:** `StudentTransaction` (breakdown/receipt removal), `StudentFeeTracking` (paid reversal), `ActivityLog` (audit).

---

## POST `/api/receiptRecall`

**Auth:** Admin | **Instant recall — no approval needed**

### Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `receiptNo` | string | ✓ | Receipt containing the breakdowns |
| `rollNo` | string | ✓ | Student roll number |
| `reason` | string | ✓ | Why the recall is needed |
| `breakdownIds` | string[] | ✓ | ObjectIds of breakdowns to recall (deduplicated automatically) |

```json
{
  "receiptNo": "REC-20260303-001",
  "rollNo": "25CS101",
  "reason": "Wrong semester selected",
  "breakdownIds": ["664abc123def456789000001"]
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
    "breakdownIds": ["664abc123def456789000001"],
    "breakdownSnapshots": [
      {
        "_id": "664abc123def456789000001",
        "academicYear": "2025-2026",
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
      }
    ],
    "recalledBy": "65f1a2b3c4d5e60011223344",
    "createdAt": "2026-03-07T10:30:00.000Z",
    "updatedAt": "2026-03-07T10:30:00.000Z"
  }
}
```

> `breakdownSnapshots` is a frozen copy of each recalled breakdown at the moment of recall, preserved for audit purposes.

### Errors

| Status | Condition |
|---|---|
| `400` | Missing/invalid fields or invalid ObjectId in `breakdownIds` |
| `404` | Student has no transactions, receipt not found, or breakdown not found in receipt |
| `409` | One or more breakdowns have already been recalled for this receipt |

### What happens on recall

1. Reverses `paid` in fee tracking for each recalled breakdown (academic fields, hostel, transport) and recalculates status at every level.
2. Removes recalled breakdowns from the receipt's `breakdowns[]`.
3. If no breakdowns remain → removes the entire receipt.
4. If breakdowns remain → recalculates `totalAmount`.

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
        "breakdownIds": ["664abc123def456789000001"],
        "breakdownSnapshots": [
          {
            "_id": "664abc123def456789000001",
            "academicYear": "2025-2026",
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
          }
        ],
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
