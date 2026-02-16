# Fee Management System Architecture

## System Overview

This document explains how the fee management system works - from student admission to payment tracking.

### How It Works (Simple Flow)

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

### Table 1: STUDENT (Master Data)
**Purpose:** Store student information
**Changes:** Rarely (only profile updates)

### Table 2: FEE STRUCTURE (Fee Rules)
**Purpose:** Define what fees apply to which students
**Changes:** Never (new version created for changes)

### Table 3: STUDENT FEE TRACKING (Status Table)
**Purpose:** Track who owes what and payment status
**Changes:** YES - updates whenever payment is made
**Initial Status:** UNPAID

### Table 4: PAYMENT TRANSACTIONS (Payment Log)
**Purpose:** Record every payment made
**Changes:** Never (append-only)

---

## Architecture Diagram

```
┌──────────────┐         ┌──────────────┐
│   STUDENT    │         │     FEE      │
│              │         │  STRUCTURE   │
│  (Profile)   │         │  (Fee Rules) │
└──────┬───────┘         └──────┬───────┘
       │                        │
       └────────┬───────────────┘
                ↓
       ┌────────────────────┐
       │  FEE TRACKING      │
       │  (Status: UNPAID)  │ ←─── Initially marked UNPAID
       └────────┬───────────┘
                │
                │ Payment made
                ↓
       ┌────────────────────┐
       │  TRANSACTIONS      │ ←─── Each payment stored here
       │  (Payment Log)     │
       └────────────────────┘
                │
                │ After recording payment
                ↓
       ┌────────────────────┐
       │  FEE TRACKING      │
       │  Status Updated:   │
       │  UNPAID → PARTIAL  │ ←─── Status changes automatically
       │  PARTIAL → PAID    │
       │  Balance Reduced   │
       └────────────────────┘
```

---

## TABLE 1: STUDENT (Master Profile)

### What It Stores

Basic student information that rarely changes.

### Fields

```javascript
Student {
  // Identity
  studentId: ObjectId (Primary Key)
  rollNumber: String (Unique)
  registerNumber: String (Unique)
  fullName: String
  gender: Enum ['Male', 'Female', 'Other']
  dateOfBirth: Date
  
  // Academic Details
  department: String
  program: String ['UG', 'PG', 'Diploma']
  admissionYear: Number
  currentYear: Number
  semester: Number
  
  // Classification (affects fee calculation)
  studentType: Enum ['Day Scholar', 'Hosteller', 'Transport']
  communityCategory: String
  quotaType: String
  
  // Contact Information
  mobileNumber: String
  email: String
  guardianContact: String
  guardianName: String
  
  // Status
  status: Enum ['Active', 'Graduated', 'Discontinued', 'On Leave']
  
  // Audit
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Important Notes

- This table stores WHO the student is
- Used to determine WHICH fee structure applies to them
- Based on: department, program, semester, studentType

---

## MODULE 2: FEE STRUCTURE (Immutable Rule Engine)

### Purpose

Defines **authoritative fee rules** for specific academic configurations. This is the **template** for all fee calculations.

### Schema Structure

```TABLE 2: FEE STRUCTURE (Fee Rules)

### What It Stores

Defines what fees apply for different types of students.

### Fieldsn
  department: String
  program: String
  semester: Number
  studentType: Enum ['Day Scholar', 'Hosteller', 'Transport']
  quota: String (optional)
  category: String (optional)
  
  // Fee Components (Heads)
  feeHeads: [
    {
      name: String
      amount: Number
      mandatory: Boolean
      description: String
    }
  ]
  
  // Example Fee Heads:
  // - Tuition Fee
  // - Exam Fee
  // - Lab Fee
  // - Library Fee
  // - Hostel Fee
  // - Transport Fee
  // - Miscellaneous Charges
  
  // Concession Rules (Optional)
  concessionRules: [
    {
      type: Enum ['Community', 'Scholarship', 'Staff Ward', 'Merit']
      eligibilityCriteria: Object
      discountPercentage: Number
      discountAmount: Number
      applicableTo: [String] // fee head names
    }
  ]
  
  // Total
  totalAmount: Number
  
  // Metadata
  isActive: Boolean
  version: Number
  createdBy: ObjectId
  approvedBy: ObjectId
  approvedAt: DateTime
  
  // Audit
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Key Characteristics

✓ **Immutable after approval**
✓ One structure per configuration
✓ Versioned for changes
✓ Archived, never deleted

### Usage Rules
Important Notes

- One fee structure defines fees for: specific department + semester + student type
- Example: CSE, Semester 1, Day Scholar = ₹50,000 (broken into fee heads)
- This is just the TEMPLATE - not actual student fees yet fee tracking system**. It represents:
- **What the student owes** (demand snapshot)
- **How much they've paid** (tracking)
- **What remains** (balance calculation)

### Generation Strategy

#### For Existing Students (Manual)
- Admin manually generates fee demand
- Validates rules before generation
- Good for migration and verification
- Batch generation with oversight
TABLE 3: STUDENT FEE TRACKING (The Payment Status Table)

### What It Stores

**This is the MAIN tracking table.** For each student, it stores:
- What fees they need to pay
- How much they've paid so far
- Current balance
- Payment status (UNPAID / PARTIAL / PAID)

### How It Gets Created

**When a student is added:**
1. System looks at the student's department, semester, and type
2. Finds matching FEE STRUCTURE
3. Copies those fees into THIS table for that student
4. **Initially marks everything as UNPAID and balance = total amount**

**Example:**
- Student: John (CSE, Semester 1, Day Scholar)
- System finds: FeeStructure for CSE-Sem1-DayScholar = ₹50,000
- Creates entry in THIS table:
  - Total Fee: ₹50,000
  - Paid: ₹0
  - Balance: ₹50,000
  - **Status: UNPAID**

### Fields
    academicYear: String
  }
  
  // Fee Breakdown (Copied from FeeStructure)
  feeHeads: [
    {
      name: String
      baseAmount: Number
      concessionAmount: Number
      payableAmount: Number
      mandatory: Boolean
    }
  ]
  
  // Concession Applied
  concessionDetails: {
    type: String
    percentage: Number
    totalConcession: Number
    approvedBy: ObjectId
    remarks: String
  }
  
  // Financial Summary (MUTABLE - updates with payments)
  totalFeeAmount: Number        // Original total
  totalConcession: Number        // Discount applied
  totalPayable: Number           // After concession
  totalPaid: Number              // Sum of all payments
  balanceAmount: Number          // Remaining to pay
  fineAmount: Number             // Late fee accumulated
  adjustmentAmount: Number       // Special adjustments
  
  // Tracking Status (MUTABLE - derived from payments)
  paymentStatus: Enum [
    'NOT_PAID',     // totalPaid = 0
    'PARTIAL',      // 0 < totalPaid < totalPayable
    'PAID',         // totalPaid = totalPayable
    'OVERDUE',      // past due date with balance > 0
    'OVERPAID'      // totalPaid > totalPayable
  ]
  
  // Timeline
  dueDate: Date
  lastPaymentDate: Date
  paidInFullDate: Date
  
  // Payment References
  transactionIds: [ObjectId]     // Links to payment transactions
  
  // Flags
  isDemandGenerated: Boolean
  isFinalized: Boolean
  isCancelled: Boolean
  
  // Audit
  generatedBy: ObjectId
  generatedAt: DateTime
  lastModifiedBy: ObjectId
  updatedAt: DateTime
  remarks: String
}
```

### Status Calculation Logic

The `paymentStatus` is **derived**, not manually set:

```jHow Status Gets Updated (Automatically)

**This table changes every time a payment is made:**

| Scenario | Total Fee | Paid | Balance | Status |
|----------|-----------|------|---------|--------|
| **Initially** | ₹50,000 | ₹0 | ₹50,000 | **UNPAID** |
| After 1st payment | ₹50,000 | ₹20,000 | ₹30,000 | **PARTIAL** |
| After 2nd payment | ₹50,000 | ₹40,000 | ₹10,000 | **PARTIAL** |
| After 3rd payment | ₹50,000 | ₹50,000 | ₹0 | **PAID** |

**Status Logic:**
```
If totalPaid = 0 → Status = UNPAID
If totalPaid > 0 AND < totalPayable → Status = PARTIAL
If totalPaid = totalPayable → Status = PAID
```

### Why This Table Changes

**YES, this table is UPDATED (mutable)** because:
- Payment amounts change
- Balance reduces
- Status changes from UNPAID → PARTIAL → PAID

**Every time a payment transaction is recorded:**
1. `totalPaid` increases
2. `balanceAmount` decreases
3. `paymentStatus` updates automatically
4. `lastPaymentDate` updatesN LEDGER (Immutable Financial Record)

### Purpose

**Append-only ledger** of every payment made. This is the **financial audit trail** and source of truth for all money received.

### Schema Structure

```javascript
PaymentTransaction {
  // Primary Keys
  transactionId: ObjectId (Primary Key)
  studentId: ObjectId (Foreign Key → Student)
  demandId: ObjectId (Foreign Key → StudentFeeDemand)
  
  // Payment Details
  amountPaid: Number
  paymentMode: Enum [
    'Cash',
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Demand Draft',
    'Cheque',
    'Bank Transfer'
  ]
  
  // Transaction Info
  transactionReference: String    // UTR/Transaction ID from bank
  bTABLE 4: PAYMENT TRANSACTIONS (Separate Payment Log)

### What It Stores

**Every single payment is recorded here separately.**

One student can have multiple payment records (one for each payment they make).

### Fields
      feeHeadName: String
      allocatedAmount: Number
    }
  ]
  
  // Payment Status
  paymentVerified: Boolean
  verifiedBy: ObjectId
  verifiedAt: DateTime
  
  // Reversal Support
  isReversed: Boolean
  reversalTransactionId: ObjectId    // Points to reversal entry
  reversalReason: String
  reversedBy: ObjectId
  reversedAt: DateTime
  
  // Audit Trail
  recordedBy: ObjectId              // Who entered the payment
  paidAt: DateTime                  // When payment was made
  createdAt: DateTime               // When record was created
  remarks: String
  
  // Receipt Data
  receiptGeneratedAt: DateTime
  receiptUrl: String
}
```

### Key Characteristics

✓ **Append-only** (never edit existing records)
✓ **Immutable** (use reversal for corrections)
✓ Each transaction is atomic
✓ Complete audit trail

### Payment Recording Workflow

```javascript
// Step 1: Create Transaction Record
const transaction = await PaymentTransaction.create({
  studentId,
  demandId,
  amountPaid,
  paymentMode,
  transactionReference,
  receiptNumber,
  recordedBy,
  paidAt: new Date()
});

// Step 2: Update Demand Tracking (Mutable)
const demand = await StudentFeeDemand.findById(demandId);
demand.totalPaid += amountPaid;
demand.balanceAmount = demand.totalPayable - demand.totalPaid;
demand.lastPaymentDate = new Date();
demand.transactionIds.push(transaction._id);
demaWhy Separate Table?

**Student Fee Tracking Table** → Shows CURRENT status (total paid, balance, status)
**Payment Transactions Table** → Shows HISTORY of all individual payments

### Example for One Student

**Fee Tracking Table (1 row):**
| Student | Total Fee | Paid | Balance | Status |
**When student makes a payment:**

**Step 1:** Add new record to PAYMENT TRANSACTIONS table
```
Insert new payment:
- Student: John
- Amount: ₹10,000
- Date: Jan 5, 2026
- Receipt: RCP001
```

**Step 2:** Update the STUDENT FEE TRACKING table
```
Update John's tracking record:
- totalPaid: ₹0 → ₹10,000
- balanceAmount: ₹50,000 → ₹40,000
- paymentStatus: UNPAID → PARTIAL
```

**Result:**
- Payment history is stored separately (never deleted)
- Current status is updated automatically
- Balance reduces with each payment 2. Fee Structure Setup

```
Admin defines fee structure
    ↓
Sets amounts per department/semester/type
    ↓
Approves and locks structure
    ↓
Ready for demand generation
```

### 3. Demand Generation

#### Manual (Existing Students)
```
Admin selects students
    ↓
Validates fee structure match
    ↓
Generates demand records in batch
    ↓
Review and finalize
```

#### Automatic (New Students)
```
Student admission approved
    ↓
System finds applicable fee structure
    ↓
Auto-generates demand record
    ↓
Notifies student and accounts team
```

### 4. Payment CollectStep-by-Step

### Step 1: Add Student

```
Student registered in system
→ Stored in STUDENT table
→ Example: John, CSE Department, Semester 1, Day Scholar
```

### Step 2: Fee Structure Exists

```
Fee structure already defined for:
→ CSE + Semester 1 + Day Scholar = ₹50,000
→ Contains breakdown:
   - Tuition: ₹30,000
   - Lab Fee: ₹10,000
   - Exam Fee: ₹5,000
   - Library: ₹5,000
```

### Step 3: Fees Pushed to Tracking Table (UNPAID)

```
System automatically:
→ Takes John's profile (CSE, Sem 1, Day Scholar)
→ Finds matching fee structure (₹50,000)
→ Creates record in STUDENT FEE TRACKING table

Entry created:
┌─────────────────────────────────────┐
│ Student: John                        │
│ Total Fee: ₹50,000                  │
│ Total Paid: ₹0                      │
│ Balance: ₹50,000                    │
│ Status: UNPAID                      │ ← Initially UNPAID
└─────────────────────────────────────┘
```

### Step 4: Student Makes First Payment

```
John pays ₹20,000

Transaction recorded in PAYMENT TRANSACTIONS table:
┌─────────────────────────────────────┐
│ Transaction ID: TXN001               │
│ Student: John                        │
│ Amount: ₹20,000                     │
│ Date: Jan 5, 2026                   │
│ Receipt: RCP001                     │
└─────────────────────────────────────┘
```

### Step 5: Tracking Table Updated Automatically

```
System updates STUDENT FEE TRACKING table:
┌─────────────────────────────────────┐
│ Student: John                        │
│ Total Fee: ₹50,000                  │
│ Total Paid: ₹20,000 ← Updated       │
│ Balance: ₹30,000    ← Reduced       │
│ Status: PARTIAL     ← Changed       │
└─────────────────────────────────────┘
```

### Step 6: Student Makes Second Payment

```
John pays another ₹30,000

New transaction recorded:
┌─────────────────────────────────────┐
│ Transaction ID: TXN002               │
│ Student: John                        │
│ Amount: ₹30,000                     │
│ DKEY RULES

### Which Tables Change and Which Don't

| Table | Can Change? | When? |
|-------|-------------|-------|
| **STUDENT** | Rarely | Only profile updates |
| **FEE STRUCTURE** | No | Create new version if needed |
| **FEE TRACKING** | **YES** | Every payment updates it |
| **PAYMENT TRANSACTIONS** | No | Only add new records |

### Balance Calculation

```
Balance = Total Fee - Total Paid
```

Simple formula that updates automatically after each payment.stallments

**Scenario:** Fee paid in 3 installments

**Handling:**
```javascript
- Three separate transaction records
- Each updates the demand tracking
- Balance decreases with each payment
- Status changes from PARTIAL → PAID
```

### 3. Overpayment

**Scenario:** Student pays ₹51,000 for ₹50,000 fee

**Handling:**
```javascript
- RCOMMON SCENARIOS

### Scenario 1: Partial Payment

**Student pays in installments**

| Payment | Amount | Paid So Far | Balance | Status |
|---------|--------|-------------|---------|--------|
| Initial | - | ₹0 | ₹50,000 | UNPAID |
| Payment 1 | ₹10,000 | ₹10,000 | ₹40,000 | PARTIAL |
| Payment 2 | ₹20,000 | ₹30,000 | ₹20,000 | PARTIAL |
| Payment 3 | ₹20,000 | ₹50,000 | ₹0 | PAID |

Each payment:
- Adds new record to Payment Transactions table
- Updates the Fee Tracking table automatically

### Scenario 2: Multiple Students, Same Fee Structure

**3 students from same department/semester/type:**

| Student | Total Fee | Paid | Balance | Status |
|---------|-----------|------|---------|--------|
| John | ₹50,000 | ₹50,000 | ₹0 | PAID |
| Sarah | ₹50,000 | ₹20,000 | ₹30,000 | PARTIAL |
| Mike | ₹50,000 | ₹0 | ₹50,000 | UNPAID |

All three:
- Share same FeeStructure (same rules)
- Have separate entries in Fee Tracking table
- Have separate payment transaction records
- Tracked independently

### Query Optimization Tips

- Use projection to fetch only required fields
- Implement pagination for large result sets
- Cache frequently accessed fee structures
- Use aggregation pipelines for reports
- Implement read replicas for analytics

---

## SECURITY & ACCESS CONTROL

### Role-Based Access

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: create structures, generate demands, record payments, view all reports |
| **Accounts Officer** | Record payments, generate receipts, view student dues, basic reports |
| **Department Head** | View department student fees, generate department reports |
| **Student** | View own fee details, payment history, download receipts |
| **Auditor** | Read-only access to all financial records |

### Audit Logging

Log all critical operations:
- Fee demand generation
- Payment recording
- Payment reversals
- Concession approvals
- Fee structure modifications
- Manual adjustments

---

## REPORTING CAPABILITIES

### Student-Level Reports

- Individual fee statement
- Payment history
- Pending dues
- Receipt printout

### Department-Level Reports

- Department-wise collection summary
- Pending dues by department
- Payment mode analysis
- Semester-wise breakdown

### Institutional Reports

- Daily collection report
- Monthly revenue summary
- Outstanding dues dashboard
- Payment trend analysis
- Concession utilization report

### Audit Reports

- Transaction ledger (date range)
- Reconciliation report
- Reversed transactions log
- Overdue accounts list

---
DASHBOARD VIEWS

### What Admin Can See

**Fee Collection Dashboard:**
- Total fees collected today/month
- Pending fees by department
- List of students with UNPAID status
- List of students with PARTIAL status
- Overdue payments

**Student Fee Status:**
- Search any student
- See their total fee, paid amount, balance
- See payment history (all transactions)
- Generate receiptsSUMMARY: How The System Works

### The Exact Flow

```
1. Student Added to System
   → Stored in STUDENT table

2. Fee Structure Applied
   → System finds matching fee structure
   → Based on: department + semester + student type

3. Fees Pushed to Tracking Table
   → New entry created in STUDENT FEE TRACKING table
   → Status: UNPAID
   → Balance: Full amount

4. Student Makes Payment
   → New record added to PAYMENT TRANSACTIONS table
   → This table stores each payment separately

5. Tracking Table Updated Automatically
   → Total Paid increases
   → Balance decreases
   → Status changes: UNPAID → PARTIAL → PAID
```

### The 4 Tables

1. **STUDENT** → Who the student is (profile)
2. **FEE STRUCTURE** → Fee rules (what to charge)
3. **STUDENT FEE TRACKING** → Current status (how much paid/balance)
4. **PAYMENT TRANSACTIONS** → Payment history (each payment recorded)

### Key Points

✓ When student added, fees are **pushed to tracking table**
✓ Everything starts as **UNPAID**
✓ Payments are **tracked separately** for each student
✓ Tracking table **gets updated** after each payment
✓ Balance **reduces automatically**
✓ Status changes: **UNPAID → PARTIAL → PAID**

---

**Document Version:** 1.0
**Last Updated:** February 16, 2026