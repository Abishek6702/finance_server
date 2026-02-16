# Fee Management System Architecture

## Overview

This document explains how the fee management system works — from student admission to payment tracking.

---

## How It Works

```
Step 1: Student Added
    ↓
Step 2: Fee Structure Applied (based on department, semester, type)
    ↓
Step 3: Fees Pushed to Tracking Table (Status: UNPAID)
    ↓
Step 4: Student Makes Payment
    ↓
Step 5: Transaction Recorded Separately
    ↓
Step 6: Tracking Table Updated (Balance Reduced, Status Changed)
```

---

## The 4 Core Tables

| Table | Purpose | Mutability |
|---|---|---|
| **Student** | Store student information | Rarely changes (profile updates only) |
| **Fee Structure** | Define fee rules per student type | Never — new version created for changes |
| **Student Fee Tracking** | Track who owes what and payment status | **Yes** — updates on every payment |
| **Payment Transactions** | Record every payment made | Append-only — never modified |

---

## Architecture Diagram

```
┌──────────────┐         ┌──────────────┐
│   STUDENT    │         │     FEE      │
│   (Profile)  │         │  STRUCTURE   │
│              │         │  (Fee Rules) │
└──────┬───────┘         └──────┬───────┘
       │                        │
       └────────┬───────────────┘
                ↓
       ┌────────────────────┐
       │   FEE TRACKING     │  ← Initially marked UNPAID
       │  Status: UNPAID    │
       └────────┬───────────┘
                │ Payment made
                ↓
       ┌────────────────────┐
       │   TRANSACTIONS     │  ← Each payment stored here
       │   (Payment Log)    │
       └────────┬───────────┘
                │ After recording payment
                ↓
       ┌────────────────────┐
       │   FEE TRACKING     │
       │  UNPAID → PARTIAL  │  ← Status changes automatically
       │  PARTIAL → PAID    │
       │  Balance Reduced   │
       └────────────────────┘
```

---

## Table 1: Student

### Purpose

Stores basic student information that rarely changes. Used to determine which fee structure applies, based on department, program, semester, and student type.

### Schema

```js
Student {
  // Identity
  studentId:        ObjectId   // Primary Key
  rollNumber:       String     // Unique
  registerNumber:   String     // Unique
  fullName:         String
  gender:           Enum ['Male', 'Female', 'Other']
  dateOfBirth:      Date

  // Academic Details
  department:       String
  program:          Enum ['UG', 'PG', 'Diploma']
  admissionYear:    Number
  currentYear:      Number
  semester:         Number

  // Classification (affects fee calculation)
  studentType:      Enum ['Day Scholar', 'Hosteller', 'Transport']
  communityCategory: String
  quotaType:        String

  // Contact
  mobileNumber:     String
  email:            String
  guardianName:     String
  guardianContact:  String

  // Status
  status:           Enum ['Active', 'Graduated', 'Discontinued', 'On Leave']

  // Audit
  createdAt:        DateTime
  updatedAt:        DateTime
}
```

---

## Table 2: Fee Structure

### Purpose

Defines fee rules for different student types. This is a **template only** — not actual student fees. A new version is created if rules change.

### Schema

```js
FeeStructure {
  // Identification
  feeStructureId: ObjectId   // Primary Key
  academicYear:   String

  // Scope
  department:     String
  program:        String
  semester:       Number
  studentType:    Enum ['Day Scholar', 'Hosteller', 'Transport']
  quota:          String     // optional
  category:       String     // optional

  // Fee Components
  feeHeads: [
    {
      name:        String    // e.g. Tuition Fee, Exam Fee, Lab Fee
      amount:      Number
      mandatory:   Boolean
      description: String
    }
  ]

  // Concession Rules (optional)
  concessionRules: [
    {
      type:                 Enum ['Community', 'Scholarship', 'Staff Ward', 'Merit']
      eligibilityCriteria:  Object
      discountPercentage:   Number
      discountAmount:       Number
      applicableTo:         [String]  // fee head names
    }
  ]

  // Summary
  totalAmount: Number

  // Metadata
  isActive:    Boolean
  version:     Number
  createdBy:   ObjectId
  approvedBy:  ObjectId
  approvedAt:  DateTime

  // Audit
  createdAt:   DateTime
  updatedAt:   DateTime
}
```

> **Example:** CSE + Semester 1 + Day Scholar = ₹50,000 (broken into fee heads)

---

## Table 3: Student Fee Tracking

### Purpose

The **main tracking table**. For each student it stores: what fees they owe, how much has been paid, the current balance, and the payment status.

### How It Gets Created

When a student is added, the system:

1. Reads the student's department, semester, and type
2. Finds the matching Fee Structure
3. Copies those fees into this table for that student
4. Sets initial status to **UNPAID** with balance = total amount

### Schema

```js
StudentFeeTracking {
  // Keys
  demandId:        ObjectId   // Primary Key
  studentId:       ObjectId   // → Student
  feeStructureId:  ObjectId   // → FeeStructure

  // Student Snapshot (frozen at generation time)
  studentSnapshot: {
    rollNumber:    String
    fullName:      String
    department:    String
    program:       String
    studentType:   String
    semester:      Number
    academicYear:  String
  }

  // Fee Breakdown (copied from FeeStructure)
  feeHeads: [
    {
      name:             String
      baseAmount:       Number
      concessionAmount: Number
      payableAmount:    Number
      mandatory:        Boolean
    }
  ]

  // Concession Applied
  concessionDetails: {
    type:             String
    percentage:       Number
    totalConcession:  Number
    approvedBy:       ObjectId
    remarks:          String
  }

  // Financial Summary  ← MUTABLE
  totalFeeAmount:    Number   // Original total
  totalConcession:   Number   // Discount applied
  totalPayable:      Number   // After concession
  totalPaid:         Number   // Sum of all payments
  balanceAmount:     Number   // Remaining to pay
  fineAmount:        Number   // Late fee accumulated
  adjustmentAmount:  Number   // Special adjustments

  // Status  ← MUTABLE
  paymentStatus: Enum [
    'NOT_PAID',   // totalPaid = 0
    'PARTIAL',    // 0 < totalPaid < totalPayable
    'PAID',       // totalPaid = totalPayable
    'OVERDUE',    // past due date with balance > 0
    'OVERPAID'    // totalPaid > totalPayable
  ]

  // Timeline
  dueDate:          Date
  lastPaymentDate:  Date
  paidInFullDate:   Date

  // References
  transactionIds:   [ObjectId]

  // Flags
  isDemandGenerated: Boolean
  isFinalized:       Boolean
  isCancelled:       Boolean

  // Audit
  generatedBy:      ObjectId
  generatedAt:      DateTime
  lastModifiedBy:   ObjectId
  updatedAt:        DateTime
  remarks:          String
}
```

### Status Logic

```
totalPaid = 0                          → NOT_PAID
totalPaid > 0  AND  < totalPayable     → PARTIAL
totalPaid = totalPayable               → PAID
```

### Status Progression Example

| Stage | Total Fee | Paid | Balance | Status |
|---|---|---|---|---|
| Initially | ₹50,000 | ₹0 | ₹50,000 | `NOT_PAID` |
| After 1st payment | ₹50,000 | ₹20,000 | ₹30,000 | `PARTIAL` |
| After 2nd payment | ₹50,000 | ₹40,000 | ₹10,000 | `PARTIAL` |
| After 3rd payment | ₹50,000 | ₹50,000 | ₹0 | `PAID` |

> **Why this table is mutable:** `totalPaid`, `balanceAmount`, `paymentStatus`, and `lastPaymentDate` all update on every payment.

---

## Table 4: Payment Transactions

### Purpose

An **append-only log** of every payment made. One student can have multiple records — one per payment.

### Schema

```js
PaymentTransaction {
  // Keys
  transactionId: ObjectId   // Primary Key
  studentId:     ObjectId   // → Student
  demandId:      ObjectId   // → StudentFeeTracking

  // Payment Details
  amountPaid:   Number
  paymentMode:  Enum [
    'Cash', 'UPI', 'Credit Card', 'Debit Card',
    'Net Banking', 'Demand Draft', 'Cheque', 'Bank Transfer'
  ]

  // Transaction Info
  transactionReference: String   // UTR / bank transaction ID
  bankName:             String
  bankTransactionDate:  Date
  receiptNumber:        String   // Unique

  // Fee Head Allocation (optional)
  feeHeadAllocations: [
    {
      feeHeadName:     String
      allocatedAmount: Number
    }
  ]

  // Verification
  paymentVerified: Boolean
  verifiedBy:      ObjectId
  verifiedAt:      DateTime

  // Reversal Support
  isReversed:             Boolean
  reversalTransactionId:  ObjectId
  reversalReason:         String
  reversedBy:             ObjectId
  reversedAt:             DateTime

  // Audit
  recordedBy:           ObjectId   // Who entered the payment
  paidAt:               DateTime   // When payment was made
  createdAt:            DateTime
  remarks:              String

  // Receipt
  receiptGeneratedAt:   DateTime
  receiptUrl:           String
}
```

### Two-Table Relationship Example

**Fee Tracking** (1 row per student — current status):

| Student | Total Fee | Paid | Balance | Status |
|---|---|---|---|---|
| John | ₹50,000 | ₹30,000 | ₹20,000 | `PARTIAL` |

**Payment Transactions** (1 row per payment — full history):

| Transaction ID | Student | Amount | Date | Receipt |
|---|---|---|---|---|
| TXN001 | John | ₹10,000 | Jan 5 | RCP001 |
| TXN002 | John | ₹10,000 | Jan 15 | RCP002 |
| TXN003 | John | ₹10,000 | Jan 25 | RCP003 |

---

## Complete Workflow

### Step 1 — Add Student

```
Student registered → stored in STUDENT table
Example: John, CSE, Semester 1, Day Scholar
```

### Step 2 — Match Fee Structure

```
Fee structure already defined:
  CSE + Semester 1 + Day Scholar = ₹50,000
  Breakdown:
    Tuition:  ₹30,000
    Lab Fee:  ₹10,000
    Exam Fee:  ₹5,000
    Library:   ₹5,000
```

### Step 3 — Generate Tracking Record

```
System creates entry in STUDENT FEE TRACKING:
  Student:    John
  Total Fee:  ₹50,000
  Total Paid: ₹0
  Balance:    ₹50,000
  Status:     NOT_PAID  ← initial
```

### Step 4 — First Payment

```
John pays ₹20,000

New record in PAYMENT TRANSACTIONS:
  Transaction ID: TXN001
  Student:        John
  Amount:         ₹20,000
  Date:           Jan 5, 2026
  Receipt:        RCP001
```

### Step 5 — Tracking Record Updated

```
STUDENT FEE TRACKING updated automatically:
  Total Paid: ₹0       → ₹20,000
  Balance:    ₹50,000  → ₹30,000
  Status:     NOT_PAID → PARTIAL
```

### Step 6 — Final Payment

```
John pays another ₹30,000

New record in PAYMENT TRANSACTIONS:
  Transaction ID: TXN002
  Amount:         ₹30,000
  Date:           Feb 10, 2026
  Receipt:        RCP002

STUDENT FEE TRACKING updated:
  Total Paid: ₹50,000
  Balance:    ₹0
  Status:     PAID  ✓
```

---

## Common Scenarios

### Scenario 1 — Paying in Installments

| Payment | Amount | Paid So Far | Balance | Status |
|---|---|---|---|---|
| Initial | — | ₹0 | ₹50,000 | `NOT_PAID` |
| Payment 1 | ₹10,000 | ₹10,000 | ₹40,000 | `PARTIAL` |
| Payment 2 | ₹20,000 | ₹30,000 | ₹20,000 | `PARTIAL` |
| Payment 3 | ₹20,000 | ₹50,000 | ₹0 | `PAID` |

### Scenario 2 — Multiple Students, Same Fee Structure

| Student | Total Fee | Paid | Balance | Status |
|---|---|---|---|---|
| John | ₹50,000 | ₹50,000 | ₹0 | `PAID` |
| Sarah | ₹50,000 | ₹20,000 | ₹30,000 | `PARTIAL` |
| Mike | ₹50,000 | ₹0 | ₹50,000 | `NOT_PAID` |

All three share the same Fee Structure but have independent tracking records and separate transaction histories.

---

## Dashboard Views

**Fee Collection Dashboard:**
- Total fees collected today / this month
- Pending fees by department
- Students with `NOT_PAID` or `PARTIAL` status
- Overdue payments

**Student Fee Detail:**
- Search any student
- View total fee, paid amount, and balance
- Full payment history (all transactions)
- Generate receipts

---

## Key Rules Summary

| Rule | Detail |
|---|---|
| Balance formula | `Balance = Total Fee − Total Paid` |
| Status on creation | Always `NOT_PAID` |
| Fee Structure mutability | Never modified — new version created |
| Transaction records | Append-only — never deleted or edited |
| Tracking record | Updated automatically after each payment |

---

*Document Version: 1.0 · Last Updated: February 16, 2026*