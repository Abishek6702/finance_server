# Postman Quick-Start Guide

## 1. Setup

1. **Import collection** — drag `Qpulse_Finance_API.postman_collection.json` into Postman.
2. **Create environment** — click ⚙️ → **Add** → name it `Qpulse Local`. Add one variable:

   | Variable | Initial Value |
   |---|---|
   | `base_url` | `http://localhost:5010/api` |

3. **Select environment** — pick `Qpulse Local` from the top-right dropdown.

> All other variables (`token`, `academic_year`, `student_roll_no`, `receipt_no`) are **auto-generated** by the collection's pre-request script. No manual setup needed.

## 2. Auth (collection-level)

The collection uses **Bearer token** auth with `{{token}}`. Login once and the token is auto-captured — every subsequent request inherits it.

## 3. Walkthrough: Full Flow

Run these requests **in order** from the Postman sidebar:

### Step 1 — Login
`Auth` → **Login Superadmin** → Send  
Token is auto-saved to `{{token}}`.

### Step 2 — Create Fee Structure
`Fee Structure Master` → **Create Fee Structure** → Send  
Creates academic fee structure for `{{academic_year}}` (auto-set to current year).

### Step 3 — Create Student
`Students Management` → **Create Student** → Send  
Creates a student with roll `{{student_roll_no}}` linked to the fee structure above.

### Step 4 — View Fee Tracking
`Student Fee Tracking` → **Get Students with Fee Tracking** → Send  
Enable the `rollNo` query param and set to `{{student_roll_no}}`. Shows the full fee ledger with all amounts unpaid.

### Step 5 — Make a Payment
`Fee Payment` → **Create Payment** → Send  
Pays towards specific breakdowns (academic/hostel/transport). Note the `receiptNo` and breakdown `_id`s in the response — you'll need them for recall.

### Step 6 — Verify Payment
`Fee Payment` → **Get Student Transactions** → Send  
Confirm the receipt and breakdowns are recorded. Copy a breakdown `_id` from the response.

### Step 7 — Recall Breakdowns
`Receipt Recall` → **Recall Breakdowns (Admin)** → Update the body:
```json
{
  "receiptNo": "<paste receipt number>",
  "rollNo": "{{student_roll_no}}",
  "reason": "Testing recall",
  "breakdownIds": ["<paste breakdown _id>"]
}
```
Send → the breakdown is instantly reversed.

### Step 8 — Verify Recall
- Re-run **Get Student Transactions** — the recalled breakdown is removed from the receipt.
- Re-run **Get Students with Fee Tracking** — paid amounts are back to pre-payment values.
- `Receipt Recall` → **Get Recall History** → confirms the recall record with snapshot.
