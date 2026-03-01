# Fee Management System

**Last Updated:** February 19, 2026

---

## Folder Structure
backend/
│
├─ src/
│
│   ├─ api/                        # All feature modules
│   │
│   │   ├─ auth/
│   │   │   ├─ controller.js
│   │   │   ├─ service.js
│   │   │   ├─ routes.js
│   │   │   └─ validation.js
│   │   │
│   │   ├─ students/
│   │   │   ├─ controller.js
│   │   │   ├─ service.js
│   │   │   ├─ routes.js
│   │   │   └─ validation.js
│   │   │
│   │   ├─ fees/
│   │   │   ├─ controller.js
│   │   │   ├─ service.js
│   │   │   ├─ routes.js
│   │   │   └─ validation.js
│   │   │
│   │   └─ transactions/
│   │       ├─ controller.js
│   │       ├─ service.js
│   │       ├─ routes.js
│   │       └─ validation.js
│   │
│   ├─ config/
│   │   └─ db.js
│   │
│   ├─ middleware/
│   │   ├─ corsMiddleware.js
│   │   ├─ authMiddleware.js
│   │   └─ errorHandler.js
│   │
│   ├─ models/
│   │   ├─ ActivityLog.js
│   │   ├─ FeeStructureMaster.js
│   │   ├─ Student.js
│   │   ├─ StudentFeeTracking.js
│   │   ├─ StudentTransaction.js
│   │   └─ User.js
│   │
│   ├─ utils/
│   │   ├─ generateLedger.js
│   │   ├─ generateToken.js
│   │   ├─ rebuildLedgers.js
│   │   ├─ sendMail.js
│   │   ├─ templateHandler.js
│   │   └─ mailTemplates/
│   │       └─ forgotPassword.js
│   │
│   ├─ app.js
│   └─ server.js
│
├─ Doc/
│   └─ FeeManagementArchitecture.md
│
├─ .env
├─ .gitignore
└─ package.json

---

## Overview

Handles student fee collection end-to-end — stores fee structures, generates personalized ledgers for each student, records payments, and keeps balances accurate across all academic years.

---

## Flow

```
Fee Management Flow
│
├─ Admin defines Fee Structure
│   └─ Set fees by quota / program / dept / semester
│       └─ Transport & hostel fees added separately
│
├─ Student Created
│   └─ Trigger: Auto-generate Ledger
│       ├─ For each academic year in batch
│       │   ├─ Find matching Fee Structure
│       │   ├─ Match quota → program → department
│       │   ├─ Pick 2 semesters for study year
│       │   ├─ Apply special concession (tuition /transport / hostel)
│       │   ├─ Apply yearly scheme concessions
│       │   └─ Compute year total = academic + transport + hostel
│       └─ Save → StudentFeeTracking
│
├─ Payment Recorded
│   ├─ Breakdown by academic year + component
│   ├─ Add paid amounts to each component
│   ├─ Recalculate statuses (Unpaid / Partially Paid / Paid)
│   └─ Save → StudentTransaction
│
└─ Fee Structure Updated
    ├─ Find students whose batch spans the changed year
    ├─ Snapshot current paid amounts
    ├─ Regenerate ledgers (force rebuild)
    ├─ Restore paid amounts
    └─ New outstanding = new total − old paid
```

---

## Components

### Fee Structure Master
Defines the institution's official fees for each academic year. Organizes academic fees by quota, education type, degree program, department, and semester. Also holds transport fees per route/stop and hostel fees per block/room type. All totals cascade automatically — edit any fee and every parent total updates.

### Student
Stores personal, academic, enrollment, transport, and hostel details for each student. On creation, automatically triggers ledger generation. Holds concession eligibility: special concessions (tuition, transport, hostel) and yearly scheme concessions (First Graduate, 7.5%, PMSS, Sakthi).

### Student Fee Tracking
The personalized ledger for a student. Contains one record per academic year. Each year holds odd and even semester breakdowns (tuition, exam, ERP, book, lab), transport, hostel, all concession values, and a final payable total. Every fee component tracks three values: total due, amount paid, and payment status (Unpaid / Partially Paid / Paid).

### Student Transaction
Complete payment history. Each payment stores receipt number, method, date, remarks, and a breakdown specifying which academic year and which fee components were covered. Supports partial payments and payments spanning multiple years.

---

## How It Works

### Ledger Generation
When a student is created, the system determines how many academic years to generate based on their batch. For each year it finds the matching fee structure and extracts the two semesters for that study year (e.g. Year 2 → semesters 3 & 4). Transport and hostel fees are matched if applicable. Special concessions are applied at semester and component level. Yearly scheme concessions are applied to the academic subtotal. The final year total is academic + transport + hostel. Generation stops if a fee structure is missing for any year.

### Calculation Order
1. Sum semester components (tuition + exam + ERP + book + lab) → semester subtotal
2. Subtract special concession → semester total
3. Sum both semester totals → academic subtotal
4. Subtract yearly scheme concessions → academic total
5. Add transport total (after its concession) and hostel total (after its concession) → year total

### Payment Recording
A payment specifies a breakdown of which components and years it covers. The system adds paid amounts to each matching component in the tracking ledger and recalculates statuses automatically.

### Fee Structure Updates
When fees change, the system identifies all students whose batch spans that academic year, snapshots their current paid amounts, regenerates their ledgers with the new fees, then restores all paid amounts. Outstanding balances automatically reflect the new totals.

---

## Key Rules

- A student's ledger only exists for years where a fee structure has been defined.
- Ledgers are generated automatically on student creation and regenerated (with payments preserved) when fee structures change.
- Payment status is computed automatically based on paid vs total — no manual entry.
- Each student has exactly one tracking document and one transaction document.

---

## Payment Status Logic

| Condition | Status |
|---|---|
| Paid = 0 | Unpaid |
| 0 < Paid < Total | Partially Paid |
| Paid ≥ Total | Paid |

Applies at every level: individual component, semester, academic year, transport, hostel, and overall year total.