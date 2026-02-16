# Fee Management System Architecture

## System Overview

This document outlines the **ERP-grade fee management architecture** designed for scalability, audit compliance, and financial accuracy.

### Core Design Philosophy

The system follows a **separation of concerns** approach:

- **Immutable Master Data** → Never changes, preserves history
- **Generated Demand Snapshots** → Point-in-time fee calculations
- **Mutable Tracking Ledger** → Real-time payment status
- **Immutable Transaction Records** → Append-only payment log

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FEE MANAGEMENT SYSTEM                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   STUDENT    │     │     FEE      │     │   DEMAND &   │
│   (Master)   │────▶│  STRUCTURE   │────▶│   TRACKING   │
│  Immutable   │     │  (Rules)     │     │   Mutable    │
└──────────────┘     │  Immutable   │     └──────┬───────┘
                     └──────────────┘            │
                                                 │
                                          ┌──────▼───────┐
                                          │ TRANSACTION  │
                                          │   LEDGER     │
                                          │  Immutable   │
                                          └──────────────┘
```

---

## MODULE 1: STUDENT (Immutable Master Data)

### Purpose

Permanent identity and academic profile of students. Acts as the **single source of truth** for student information across all financial operations.

### Schema Structure

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

### Key Characteristics

✓ **Immutable for financial operations**
✓ Changes logged, never affecting past records
✓ Snapshot data copied to demand generation
✓ Single source for student classification

### Usage Rules

- Never modify `studentId`, `rollNumber`, `registerNumber`
- Category changes don't affect past fee records
- Use snapshot approach for fee calculations
- Maintain audit trail for all updates

---

## MODULE 2: FEE STRUCTURE (Immutable Rule Engine)

### Purpose

Defines **authoritative fee rules** for specific academic configurations. This is the **template** for all fee calculations.

### Schema Structure

```javascript
FeeStructure {
  // Identification
  feeStructureId: ObjectId (Primary Key)
  academicYear: String
  
  // Scope Definition
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

- Create new version for any amount change
- Never modify after students are assigned
- Archive old versions for audit
- Maintain version history

---

## MODULE 3: STUDENT FEE DEMAND & TRACKING (Mutable Status Engine)

### Purpose

This is the **heart of the fee tracking system**. It represents:
- **What the student owes** (demand snapshot)
- **How much they've paid** (tracking)
- **What remains** (balance calculation)

### Generation Strategy

#### For Existing Students (Manual)
- Admin manually generates fee demand
- Validates rules before generation
- Good for migration and verification
- Batch generation with oversight

#### For New Students (Automatic)
- Auto-generated on admission approval
- Triggered on semester promotion
- Triggered on academic year rollover
- Ensures no student is missed

### Schema Structure

```javascript
StudentFeeDemand {
  // Primary Keys
  demandId: ObjectId (Primary Key)
  studentId: ObjectId (Foreign Key → Student)
  feeStructureId: ObjectId (Foreign Key → FeeStructure)
  
  // Snapshot Data (Immutable part - preserves history)
  studentSnapshot: {
    rollNumber: String
    fullName: String
    department: String
    program: String
    studentType: String
    semester: Number
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

```javascript
calculateStatus(demand) {
  if (demand.balanceAmount === 0 && demand.totalPaid === 0) {
    return 'NOT_PAID';
  }
  
  if (demand.totalPaid > 0 && demand.balanceAmount > 0) {
    if (Date.now() > demand.dueDate) {
      return 'OVERDUE';
    }
    return 'PARTIAL';
  }
  
  if (demand.balanceAmount === 0 && demand.totalPaid === demand.totalPayable) {
    return 'PAID';
  }
  
  if (demand.totalPaid > demand.totalPayable) {
    return 'OVERPAID';
  }
}
```

### Key Characteristics

✓ **Mutable tracking fields** (paid, balance, status)
✓ **Immutable snapshot** (student & fee details)
✓ One record per student per semester
✓ Real-time balance calculation

### Why This Table is Mutable

Updates occur when:
- ✓ Payment is recorded
- ✓ Fine is added
- ✓ Concession is approved (before payment)
- ✓ Payment is reversed/cancelled
- ✓ Adjustment is made

### Critical Update Rules

**DO UPDATE:**
- `totalPaid` (sum from transactions)
- `balanceAmount` (calculated)
- `paymentStatus` (derived)
- `lastPaymentDate`
- `transactionIds` (append)

**DON'T UPDATE:**
- `totalPayable` (after first payment)
- `studentSnapshot` (historical accuracy)
- `feeHeads` (after generation)

---

## MODULE 4: PAYMENT TRANSACTION LEDGER (Immutable Financial Record)

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
  bankName: String
  bankTransactionDate: Date
  receiptNumber: String (Unique)
  
  // Fee Head Allocation (optional breakdown)
  feeHeadAllocations: [
    {
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
demand.paymentStatus = calculateStatus(demand);
await demand.save();

// Step 3: Generate Receipt
await generateReceipt(transaction);
```

### Reversal/Cancellation Handling

**Never delete transactions.** Instead:

```javascript
// Step 1: Create reversal entry
const reversalTransaction = await PaymentTransaction.create({
  studentId,
  demandId,
  amountPaid: -originalAmount,  // NEGATIVE amount
  paymentMode: 'Reversal',
  remarks: 'Reversal of receipt #12345 - duplicate payment',
  recordedBy,
  paidAt: new Date()
});

// Step 2: Mark original transaction as reversed
originalTransaction.isReversed = true;
originalTransaction.reversalTransactionId = reversalTransaction._id;
originalTransaction.reversedBy = userId;
originalTransaction.reversedAt = new Date();
await originalTransaction.save();

// Step 3: Update demand tracking
demand.totalPaid -= originalAmount;
demand.balanceAmount = demand.totalPayable - demand.totalPaid;
demand.paymentStatus = calculateStatus(demand);
await demand.save();
```

---

## COMPLETE WORKFLOW: END-TO-END

### 1. Student Admission

```
Student Record Created
    ↓
Immutable master data stored
    ↓
Ready for fee assignment
```

### 2. Fee Structure Setup

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

### 4. Payment Collection

```
Student makes payment
    ↓
Transaction record created (immutable)
    ↓
Demand tracking updated (mutable)
    ↓
Receipt generated
    ↓
Balance recalculated
    ↓
Status updated
```

### 5. Real-time Tracking

```
Admin views dashboard
    ↓
Sees: Total payable | Total paid | Balance
    ↓
Filtered by: Department | Status | Date range
    ↓
Generates reports
```

---

## DATA INTEGRITY & AUDIT PRINCIPLES

### Immutability Rules

| Module | Type | Rule |
|--------|------|------|
| Student | Immutable Master | Academic changes logged, not overwritten |
| FeeStructure | Immutable Rule | Versioned, archived, never deleted |
| FeeDemand Snapshot | Immutable | Student/fee details frozen at generation |
| FeeDemand Tracking | Mutable | Payment status updates allowed |
| PaymentTransaction | Immutable | Append-only, reversal-based corrections |

### Balance Calculation Formula

```
balanceAmount = totalPayable - totalPaid + fineAmount - adjustmentAmount
```

Where:
- `totalPayable` = base fees - concessions
- `totalPaid` = sum of all payment transactions
- `fineAmount` = late fee penalties
- `adjustmentAmount` = special approvals

### Audit Trail Requirements

Every financial operation must log:
- ✓ Who performed the action
- ✓ When it was performed
- ✓ What was changed
- ✓ Original values (for tracking changes)
- ✓ Reason/remarks

---

## EDGE CASES & SPECIAL SCENARIOS

### 1. Partial Payments

**Scenario:** Student pays ₹5,000 of ₹50,000 total fee

**Handling:**
```javascript
- Create transaction for ₹5,000
- Update totalPaid = 5,000
- Update balanceAmount = 45,000
- Set status = 'PARTIAL'
- Allow subsequent payments
```

### 2. Multiple Installments

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
- Record full transaction
- totalPaid = 51,000
- balanceAmount = -1,000
- status = 'OVERPAID'
- Create refund workflow or carry forward
```

### 4. Late Fee Application

**Scenario:** Payment overdue by 30 days

**Handling:**
```javascript
- Calculate fine based on rules
- Update fineAmount in demand
- Adjust totalPayable
- Status = 'OVERDUE'
- Fine reflected in next payment
```

### 5. Payment Cancellation

**Scenario:** Duplicate payment by mistake

**Handling:**
```javascript
- Create reversal transaction with negative amount
- Mark original transaction as reversed
- Adjust demand tracking totals
- Maintain complete audit trail
- Never delete original record
```

### 6. Concession After Partial Payment

**Scenario:** Scholarship approved after paying ₹10,000

**Handling:**
```javascript
- Apply concession to remaining balance
- Adjust totalPayable
- Recalculate balanceAmount
- Log concession approval details
- Already-paid amount remains unchanged
```

### 7. Student Discontinuation Mid-Semester

**Scenario:** Student leaves after paying fees

**Handling:**
```javascript
- Update student status to 'Discontinued'
- Fee demand remains in system for audit
- Calculate refund if applicable
- Create refund transaction record
- Preserve all payment history
```

### 8. Academic Year Rollover

**Scenario:** New academic year begins

**Handling:**
```javascript
- Create new fee structure for new year
- Auto-generate demands for continuing students
- Close/archive previous year demands
- Carry forward any balance (if policy allows)
- Maintain separate records per year
```

---

## PERFORMANCE OPTIMIZATION

### Database Indexes

```javascript
// Student Collection
Student.index({ studentId: 1 })
Student.index({ rollNumber: 1 }, { unique: true })
Student.index({ department: 1, currentYear: 1 })
Student.index({ status: 1 })

// FeeStructure Collection
FeeStructure.index({ academicYear: 1, department: 1, semester: 1 })
FeeStructure.index({ isActive: 1 })

// StudentFeeDemand Collection
StudentFeeDemand.index({ studentId: 1, academicYear: 1 })
StudentFeeDemand.index({ demandId: 1 }, { unique: true })
StudentFeeDemand.index({ paymentStatus: 1 })
StudentFeeDemand.index({ dueDate: 1 })
StudentFeeDemand.index({ balanceAmount: 1 })

// PaymentTransaction Collection
PaymentTransaction.index({ transactionId: 1 }, { unique: true })
PaymentTransaction.index({ studentId: 1, paidAt: -1 })
PaymentTransaction.index({ demandId: 1 })
PaymentTransaction.index({ receiptNumber: 1 }, { unique: true })
PaymentTransaction.index({ paidAt: -1 })
PaymentTransaction.index({ isReversed: 1 })
```

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

## API DESIGN GUIDELINES

### RESTful Endpoints

```
# Student Module
GET    /api/students
GET    /api/students/:id
POST   /api/students
PATCH  /api/students/:id
GET    /api/students/:id/fee-demands

# Fee Structure Module
GET    /api/fee-structures
GET    /api/fee-structures/:id
POST   /api/fee-structures
GET    /api/fee-structures/search?academicYear=2024&department=CSE

# Demand Module
GET    /api/fee-demands
GET    /api/fee-demands/:id
POST   /api/fee-demands/generate       # Manual generation
POST   /api/fee-demands/auto-generate  # Batch automation
PATCH  /api/fee-demands/:id/apply-concession
GET    /api/fee-demands/:id/balance

# Payment Module
GET    /api/payments
GET    /api/payments/:id
POST   /api/payments                   # Record payment
POST   /api/payments/:id/reverse       # Cancel payment
GET    /api/payments/:id/receipt

# Reports
GET    /api/reports/collection-summary
GET    /api/reports/pending-dues
GET    /api/reports/student-statement/:studentId
```

---

## MIGRATION STRATEGY (For Existing System)

### Phase 1: Setup Master Data
1. Import all existing students
2. Validate student data
3. Set up fee structures for current year

### Phase 2: Manual Demand Generation
1. Generate demands for all existing students
2. Validate calculations
3. Review and approve in batches

### Phase 3: Payment Migration
1. Import historical payment records
2. Reconcile with current system
3. Update demand tracking

### Phase 4: Enable Automation
1. Set up triggers for new students
2. Configure semester rollover
3. Enable auto-demand generation

### Phase 5: Go Live
1. Train staff on new system
2. Run parallel for one semester
3. Phase out old system

---

## SCALABILITY CONSIDERATIONS

### Current Scale Support
- ✓ Up to 50,000 students
- ✓ 100+ concurrent users
- ✓ 10,000+ transactions per day
- ✓ 5-year historical data

### Future Scale (with optimization)
- ✓ 100,000+ students
- ✓ 500+ concurrent users
- ✓ Multi-campus deployment
- ✓ 10-year historical archive

### Scaling Strategies
- Horizontal database sharding by academic year
- Read replicas for reporting
- Caching layer for fee structures
- Async job queues for bulk operations
- Microservices for payment gateway

---

## TECHNOLOGY STACK RECOMMENDATION

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (document flexibility)
- **ORM:** Mongoose
- **Validation:** Joi / Zod

### Frontend
- **Framework:** React.js / Vue.js
- **State Management:** Redux / Zustand
- **UI Library:** Material-UI / Ant Design

### DevOps
- **Hosting:** AWS / Azure / GCP
- **Container:** Docker
- **Orchestration:** Kubernetes (optional)
- **CI/CD:** GitHub Actions / Jenkins
- **Monitoring:** New Relic / DataDog

### Security
- **Authentication:** JWT
- **Authorization:** RBAC
- **Encryption:** bcrypt, SSL/TLS
- **API Security:** Rate limiting, CORS

---

## CONCLUSION

This architecture provides:

✓ **Financial Accuracy** — Immutable transactions, append-only ledger
✓ **Audit Compliance** — Complete trail, reversal-based corrections
✓ **Scalability** — Supports thousands of students, millions of transactions
✓ **Flexibility** — Manual + automatic demand generation
✓ **Real-time Tracking** — Mutable status for live monitoring
✓ **Future-Ready** — Supports complex scenarios and edge cases

### Key Takeaways

**Student & FeeStructure**
→ Immutable master data (never changes)

**FeeDemand Tracking**
→ Mutable (tracks real-time payment status)

**PaymentTransaction**
→ Immutable ledger (append-only, reversal-based)

This separation ensures **historical accuracy, audit safety, and operational flexibility**.

---

**Document Version:** 1.0
**Last Updated:** February 16, 2026
**Status:** Production Ready
