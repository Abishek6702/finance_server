# Receipt Recall Module

Allows admins to **instantly reverse specific breakdowns** from a payment receipt. No approval workflow — recall is immediate with a reason.

- Targets individual breakdowns by `_id` (each breakdown in a receipt has a unique ObjectId).
- Partial recall keeps remaining breakdowns intact; full recall removes the entire receipt.
- Duplicate recall of the same breakdown is blocked (checked via recall history).

**Couples with:** `StudentTransaction` (breakdown/receipt removal), `StudentFeeTracking` (paid reversal), `ActivityLog` (audit).

---

## POST `/api/receiptRecall`

**Auth:** Admin | **Instant recall — no approval needed**

| Field | Type | Required | Description |
|---|---|---|---|
| `receiptNo` | string | ✓ | Receipt containing the breakdowns |
| `rollNo` | string | ✓ | Student roll number |
| `reason` | string | ✓ | Why the recall is needed |
| `breakdownIds` | string[] | ✓ | ObjectIds of breakdowns to recall |

```json
{
  "receiptNo": "REC-20260303-001",
  "rollNo": "25CS101",
  "reason": "Wrong semester selected",
  "breakdownIds": ["664abc123def456789000001"]
}
```

**Errors:** `400` missing/invalid fields · `404` student/receipt/breakdown not found · `409` breakdown already recalled

**201 →** Returns the recall record with `breakdownSnapshots` (frozen copy of recalled data).

### What happens on recall

1. Reverses `paid` in fee tracking for each recalled breakdown (academic fields, hostel, transport) and recalculates status at every level.
2. Removes recalled breakdowns from the receipt's `breakdowns[]`.
3. If no breakdowns remain → removes the entire receipt.
4. If breakdowns remain → recalculates `totalAmount`.

---

## GET `/api/receiptRecall`

**Auth:** Admin (superadmin also passes via admin guard)

| Query Param | Type | Description |
|---|---|---|
| `rollNo` | string | Filter by student |
| `receiptNo` | string | Filter by receipt |
| `page` | number | Page number (default: 1) |
| `limit` | number | Per page (omit for all) |

**200 →** `{ records: [...], pagination: { total, page, limit, totalPages } }`
