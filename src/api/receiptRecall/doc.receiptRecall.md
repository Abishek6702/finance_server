# Receipt Recall Module — API Documentation

## 1. Module Overview

The **Receipt Recall** module allows admins to request the reversal (recall) of a previously issued payment receipt. A superadmin must then approve or reject the request. When approved, the system atomically reverses all payment allocations in the student's fee tracking and removes the receipt from the transaction history.

**Dependencies / Coupling**
- **Transaction module** — reads and removes receipts from `StudentTransaction`.
- **Student Fee Tracking module** — reverses `paid` amounts and recalculates `status` per fee component on approval.
- **Activity Log** — all create / approve / reject actions are audit-logged.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `receiptrecallrequests` | `ReceiptRecallRequest` | Stores recall requests with status lifecycle |
| `studenttransactions` | `StudentTransaction` | Receipt removed on approval |
| `studentfeetrackings` | `StudentFeeTracking` | Paid amounts reversed on approval |

---

## 2. API Documentation

> **All endpoints require authentication.**
> Include `Authorization: Bearer <token>` header.

---

### POST `/api/receiptRecall`

**Auth required:** Yes — Admin

**Description:** Creates a new recall request for a specific receipt. The receipt data is snapshot at the time of creation for audit purposes.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `receiptNo` | string | Yes | Receipt number to recall |
| `rollNo` | string | Yes | Student roll number |
| `reason` | string | Yes | Reason for the recall request |

##### Example Request Body
```json
{
  "receiptNo": "REC-20260303-001",
  "rollNo": "25CS101",
  "reason": "Incorrect payment entry — wrong semester selected"
}
```

#### Validation

| Rule | Error |
|---|---| 
| `rollNo` missing or empty | 400 — `rollNo is required` |
| `reason` missing or empty | 400 — `reason is required` |
| Student not found | 404 — `No transactions found for this student` |
| Receipt not found | 404 — `Receipt '...' not found for student ...` |
| Pending recall already exists for this receipt | 409 — `A pending recall request already exists for receipt '...'` |
| Receipt already recalled (COMPLETED) | 409 — `Receipt '...' has already been recalled` |

#### Response

**201 — Success**
```json
{
  "success": true,
  "data": {
    "_id": "665...abc",
    "receiptId": "664...def",
    "receiptNo": "REC-20260303-001",
    "rollNo": "25CS101",
    "status": "PENDING",
    "reason": "Incorrect payment entry — wrong semester selected",
    "receiptSnapshot": { "...snapshotted receipt data..." },
    "createdBy": "663...user",
    "createdAt": "2026-03-03T10:00:00.000Z"
  },
  "message": "Recall request created successfully"
}
```

---

### GET `/api/receiptRecall`

**Auth required:** Yes — Admin

**Description:** Lists recall requests with optional filters and pagination.

#### Request

##### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED` |
| `rollNo` | string | No | Filter by student roll number |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Results per page (omit for all results) |

#### Validation

| Rule | Error |
|---|---|
| `status` not in allowed list | 400 |
| `page` not a positive integer | 400 |
| `limit` not a positive integer | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "665...abc",
        "receiptNo": "REC-20260303-001",
        "rollNo": "25CS101",
        "status": "PENDING",
        "reason": "Incorrect payment entry",
        "createdAt": "2026-03-03T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Recall requests fetched successfully"
}
```

---

### POST `/api/receiptRecall/:recallId/approve`

**Auth required:** Yes — Superadmin

**Description:** Approves a pending recall request. The system atomically reverses all payment allocations in the student's fee tracking and removes the receipt from the transaction history. No request body is required.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `recallId` | string | Yes | MongoDB ObjectId of the recall request |

#### Validation

| Rule | Error |
|---|---|
| `recallId` missing or invalid ObjectId | 400 — `Valid recallId is required` |
| Recall request not found | 404 — `Recall request not found` |
| Status is not `PENDING` | 400 — `Cannot approve a recall request with status '...'` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "_id": "665...abc",
    "status": "COMPLETED",
    "reviewedBy": "663...superadmin",
    "reviewedAt": "2026-03-03T11:00:00.000Z",
    "completedAt": "2026-03-03T11:00:00.000Z"
  },
  "message": "Recall approved and rollback completed"
}
```

---

### POST `/api/receiptRecall/:recallId/reject`

**Auth required:** Yes — Superadmin

**Description:** Rejects a pending recall request. A reject reason must be provided. No payment changes are made.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `recallId` | string | Yes | MongoDB ObjectId of the recall request |

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `rejectReason` | string | Yes | Reason for rejecting the recall request |

##### Example Request Body
```json
{
  "rejectReason": "Payment amount is correct — no recall needed"
}
```

#### Validation

| Rule | Error |
|---|---|
| `recallId` missing or invalid ObjectId | 400 — `Valid recallId is required` |
| `rejectReason` missing or empty | 400 — `rejectReason is required` |
| Recall request not found | 404 — `Recall request not found` |
| Status is not `PENDING` | 400 — `Cannot reject a recall request with status '...'` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "_id": "665...abc",
    "status": "REJECTED",
    "rejectReason": "Payment amount is correct — no recall needed",
    "reviewedBy": "663...superadmin",
    "reviewedAt": "2026-03-03T11:00:00.000Z"
  },
  "message": "Recall request rejected"
}
```

---

## 3. Edge Cases

- **Atomic rollback on approval:** Uses MongoDB transactions when a replica set is available; falls back to sequential saves on standalone instances.
- **Receipt snapshot:** The full receipt data is snapshot at recall-creation time. This ensures accurate rollback even if the receipt data changes between creation and approval.
- **Duplicate prevention:** Cannot create a recall for a receipt that already has a `PENDING` recall or has already been `COMPLETED`.
- **Reject reason required:** The superadmin must provide a `rejectReason` when rejecting. Approval does not require a reason.
- **No payment changes on rejection:** Rejecting a recall leaves the student's fee tracking and transaction records unchanged.
- **Status lifecycle:** `PENDING` → `COMPLETED` (on approval) or `PENDING` → `REJECTED` (on rejection). No other transitions are allowed.
