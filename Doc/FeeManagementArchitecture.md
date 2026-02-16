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
Step 3: Fees Pushed to Tracking Table (Status: NOT_PAID)
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
| --- | --- | --- |
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
│   FEE TRACKING     │  ← Initially marked NOT_PAID
│  Status: NOT_PAID  │
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
│ NOT_PAID → PARTIAL │  ← Status changes automatically
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
// ---------- 1. PERSONAL ----------
const personalSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^\d{2}[A-Z]{2}\d{3}$/, "Invalid roll number format"]
  },
  studentName: { type: String, trim: true, minlength: 1, maxlength: 100 },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  dob: Date,
  bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
  aadharNo: { type: String, trim: true, match: [/^\d{12}$/, "Aadhar must be 12 digits"] },
  emisNo: { type: String, trim: true },
  religion: { type: String, trim: true, maxlength: 50 },
  nationality: { type: String, trim: true, maxlength: 50 },
  studentPhoto: { type: String, trim: true },
  hostelDayScholar: { type: String, enum: ["Hosteller", "Day Scholar"] },
  isCollegeTransport: { type: Boolean, default: false }
}, { _id: false });


// ---------- 2. ACADEMIC ----------
const academicSchema = new mongoose.Schema({
  educationType: { type: String, enum: ["UG", "PG"] },
  academicType: { type: String, enum: ["REG", "PART_TIME"] },
  isLateralEntry: { type: Boolean, default: false },
  course: { type: String, trim: true, maxlength: 100 },//B.E CCE
  yearStudying: { type: Number, enum: [1, 2, 3, 4] },
  currentSem: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8] },
  section: { type: String, enum: ["A", "B", "C", "D", "E", "F"], uppercase: true, default: null },
  batch: {
    from: { type: Number, min: 1900, max: 2100 },
    to: { type: Number, min: 1900, max: 2100 }
  },
  currentAcademicYear: {
    from: { type: Number, min: 1900, max: 2100 },
    to: { type: Number, min: 1900, max: 2100 }
  }
}, { _id: false });


// ---------- 3. CONTACT ----------
const contactSchema = new mongoose.Schema({
  selfMobileNo: {
    type: String,
    trim: true,
    match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
  },
  selfEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
  },
  officialEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9._%+-]+@sece\.ac\.in$/, "Official email must end with @sece.ac.in"]
  }
}, { _id: false });


// ---------- 4. FAMILY ----------
const familySchema = new mongoose.Schema({
  father: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    },
    workType: { type: String, trim: true, maxlength: 50 },
    qualification: { type: String, trim: true, maxlength: 50 }
  },
  mother: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    },
    workType: { type: String, trim: true, maxlength: 50 },
    qualification: { type: String, trim: true, maxlength: 50 }
  },
  guardian: {
    name: { type: String, trim: true, maxlength: 100 },
    mobile: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"]
    }
  },
  familyIncomeAsPerCertificate: { type: Number, min: 0 },
  community: { type: String, trim: true, maxlength: 50 },
  casteName: { type: String, trim: true, maxlength: 50 },
  communityCertificateNo: { type: String, trim: true, maxlength: 50 }
}, { _id: false });


// ---------- 5. ADDRESS ----------
const addressSchema = new mongoose.Schema({
  permanent: {
    doorNo: { type: String, trim: true, maxlength: 50 },
    street: { type: String, trim: true, maxlength: 100 },
    area: { type: String, trim: true, maxlength: 100 },
    villageOrTown: { type: String, trim: true, maxlength: 100 },
    taluk: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, "Pincode must be 6 digits"]
    }
  },
  communication: {
    doorNo: { type: String, trim: true, maxlength: 50 },
    street: { type: String, trim: true, maxlength: 100 },
    area: { type: String, trim: true, maxlength: 100 },
    villageOrTown: { type: String, trim: true, maxlength: 100 },
    taluk: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, "Pincode must be 6 digits"]
    }
  }
}, { _id: false });


// ---------- 6. ENROLLMENT ----------
const enrollmentSchema = new mongoose.Schema({
  quota: { type: String, enum: ["Management Quota", "Government Quota"] },
  isFirstGraduate: { type: Boolean, default: false },
  is7point5Scheme: { type: Boolean, default: false },
  isPMSSScheme: { type: Boolean, default: false },
  isSakthiScheme: { type: Boolean, default: false }
}, { _id: false });


// ---------- MAIN STUDENT SCHEMA ----------
const studentSchema = new mongoose.Schema({
  personal: personalSchema,
  academic: academicSchema,
  contact: contactSchema,
  family: familySchema,
  address: addressSchema,
  enrollment: enrollmentSchema
}, { timestamps: true });

```

---

## Table 2: Fee Structure

### Purpose

Defines fee rules for different student types. This is a **template only** — not actual student fees. A new version is created if rules change.

### Schema

```js
const mongoose = require("mongoose");

const feeStructureSchema = new mongoose.Schema({

  // ===== IDENTIFICATION =====
  academicYear:{
    type:String,
    required:true,           // "2026-2027"
    trim:true
  },

  version:{
    type:Number,
    default:1
  },

  isActive:{
    type:Boolean,
    default:true
  },

  // ===== APPLICABILITY =====
  course:{
    type:String,             // B.E CSE, B.Tech IT
    required:true,
    trim:true
  },

  educationType:{
    type:String,
    enum:["UG","PG"]
  },

  semester:{
    type:Number,
    required:true
  },

  hostelDayScholar:{
    type:String,
    enum:["Hosteller","Day Scholar"],
    required:true
  },

  isCollegeTransport:{
    type:Boolean,
    default:false
  },

  quota:{
    type:String,
    enum:["Management Quota","Government Quota"],
    default:null
  },

  // ===== CORE ACADEMIC FEES =====
  tuitionFee:{ type:Number, default:0 },
  admissionFee:{ type:Number, default:0 },
  universityFee:{ type:Number, default:0 },
  examFee:{ type:Number, default:0 },
  labFee:{ type:Number, default:0 },
  libraryFee:{ type:Number, default:0 },
  sportsFee:{ type:Number, default:0 },
  developmentFee:{ type:Number, default:0 },
  studentWelfareFee:{ type:Number, default:0 },
  medicalFee:{ type:Number, default:0 },
  insuranceFee:{ type:Number, default:0 },
  idCardFee:{ type:Number, default:0 },

  // ===== FACILITY FEES =====
  internetFee:{ type:Number, default:0 },
  smartClassFee:{ type:Number, default:0 },
  placementTrainingFee:{ type:Number, default:0 },

  // ===== HOSTEL & TRANSPORT =====
  hostelFee:{ type:Number, default:0 },
  messFee:{ type:Number, default:0 },
  transportFee:{ type:Number, default:0 },

  // ===== REFUNDABLE DEPOSITS =====
  cautionDeposit:{ type:Number, default:0 },     // refundable
  hostelDeposit:{ type:Number, default:0 },

  // ===== MISCELLANEOUS =====
  miscellaneousFee:{ type:Number, default:0 },

  // ===== SCHEME / CONCESSION SUPPORT =====
  firstGraduateDiscount:{ type:Number, default:0 },
  scholarshipEligible:{
    type:Boolean,
    default:false
  },

  // ===== PAYMENT RULES =====
  dueDays:{
    type:Number,
    default:30
  },

  allowInstallments:{
    type:Boolean,
    default:true
  },

  maxInstallments:{
    type:Number,
    default:3
  },

  // ===== LATE FEE SETTINGS =====
  lateFeeEnabled:{
    type:Boolean,
    default:false
  },

  lateFeeAmount:{
    type:Number,
    default:0       // flat fine
  },

  lateFeePerDay:{
    type:Number,
    default:0
  },

  lateFeeMaxLimit:{
    type:Number,
    default:0
  },

  // ===== SUMMARY =====
  totalAmount:{
    type:Number,
    required:true
  },

  // ===== METADATA =====
  createdBy:{ type:mongoose.Schema.Types.ObjectId },
  approvedBy:{ type:mongoose.Schema.Types.ObjectId },
  approvedAt:{ type:Date },

  notes:{
    type:String,
    maxlength:500,
    trim:true
  }

},{ timestamps:true });

module.exports = mongoose.model("FeeStructure", feeStructureSchema);

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
4. Sets initial status to **NOT_PAID** with balance = total amount

### Schema

```js
const mongoose = require("mongoose");

const feeHeadSnapshotSchema = new mongoose.Schema({
  name:{ type:String, required:true },
  amount:{ type:Number, required:true },
  concession:{ type:Number, default:0 },
  payable:{ type:Number, required:true }
},{ _id:false });

const studentFeeTrackingSchema = new mongoose.Schema({

  // ===== KEYS =====
  demandId:{
    type:mongoose.Schema.Types.ObjectId,
    auto:true
  },

  studentId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Student",
    required:true,
    index:true
  },

  feeStructureId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"FeeStructure",
    required:true
  },

  // ===== SNAPSHOT (IMMUTABLE) =====
  studentSnapshot:{
    rollNo:String,
    studentName:String,
    course:String,
    semester:Number,
    academicYear:String,
    hostelDayScholar:String,
    isCollegeTransport:Boolean,
    quota:String
  },

  // ===== FEE BREAKDOWN SNAPSHOT =====
  feeHeads:[feeHeadSnapshotSchema],

  // ===== FINANCIAL SUMMARY =====
  totalFeeAmount:{ type:Number, required:true },   // original sum
  totalConcession:{ type:Number, default:0 },
  totalPayable:{ type:Number, required:true },

  // ===== TRACKING (MUTABLE) =====
  totalPaid:{ type:Number, default:0 },
  balanceAmount:{ type:Number, required:true },

  fineAmount:{ type:Number, default:0 },
  adjustmentAmount:{ type:Number, default:0 },

  // ===== STATUS =====
  paymentStatus:{
    type:String,
    enum:[
      "NOT_PAID",
      "PARTIAL",
      "PAID",
      "OVERDUE",
      "OVERPAID"
    ],
    default:"NOT_PAID",
    index:true
  },

  // ===== TIMELINE =====
  dueDate:{ type:Date },
  lastPaymentDate:{ type:Date },
  paidInFullDate:{ type:Date },

  // ===== PAYMENT REFERENCES =====
  transactionIds:[
    {
      type:mongoose.Schema.Types.ObjectId,
      ref:"PaymentTransaction"
    }
  ],

  // ===== FLAGS =====
  isDemandGenerated:{ type:Boolean, default:true },
  isFinalized:{ type:Boolean, default:false },
  isCancelled:{ type:Boolean, default:false },

  // ===== AUDIT =====
  generatedBy:{ type:mongoose.Schema.Types.ObjectId },
  lastModifiedBy:{ type:mongoose.Schema.Types.ObjectId },
  remarks:{ type:String, maxlength:300 }

},{ timestamps:true });

module.exports = mongoose.model("StudentFeeTracking", studentFeeTrackingSchema);

```

### Status Logic

```
totalPaid = 0                          → NOT_PAID
totalPaid > 0  AND  < totalPayable     → PARTIAL
totalPaid = totalPayable               → PAID
```

### Status Progression Example

| Stage | Total Fee | Paid | Balance | Status |
| --- | --- | --- | --- | --- |
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
const mongoose = require("mongoose");

const feeAllocationSchema = new mongoose.Schema({
  feeHead:{ type:String, required:true },
  amount:{ type:Number, required:true }
},{ _id:false });

const paymentTransactionSchema = new mongoose.Schema({

  // ===== KEYS =====
  transactionId:{
    type:mongoose.Schema.Types.ObjectId,
    auto:true
  },

  studentId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Student",
    required:true,
    index:true
  },

  demandId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"StudentFeeTracking",
    required:true,
    index:true
  },

  // ===== PAYMENT DETAILS =====
  amountPaid:{
    type:Number,
    required:true,
    min:0
  },

  paymentMode:{
    type:String,
    enum:[
      "Cash",
      "UPI",
      "Debit Card",
      "Credit Card",
      "Net Banking",
      "Bank Transfer",
      "Demand Draft",
      "Cheque"
    ],
    required:true
  },

  // ===== BANK / GATEWAY INFO =====
  transactionReference:{
    type:String,   // UTR / gateway reference
    trim:true
  },

  bankName:{ type:String, trim:true },

  bankTransactionDate:{ type:Date },

  // ===== RECEIPT =====
  receiptNumber:{
    type:String,
    required:true,
    unique:true,
    index:true
  },

  receiptGeneratedAt:{ type:Date },
  receiptUrl:{ type:String },

  // ===== OPTIONAL ALLOCATION =====
  feeHeadAllocations:[feeAllocationSchema],

  // ===== VERIFICATION =====
  paymentVerified:{
    type:Boolean,
    default:true
  },

  verifiedBy:{ type:mongoose.Schema.Types.ObjectId },
  verifiedAt:{ type:Date },

  // ===== REVERSAL / REFUND SUPPORT =====
  isReversed:{
    type:Boolean,
    default:false
  },

  reversalTransactionId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"PaymentTransaction"
  },

  reversalReason:{ type:String },

  reversedBy:{ type:mongoose.Schema.Types.ObjectId },
  reversedAt:{ type:Date },

  // ===== AUDIT =====
  recordedBy:{
    type:mongoose.Schema.Types.ObjectId,
    required:true
  },

  paidAt:{
    type:Date,
    required:true,
    default:Date.now
  },

  remarks:{
    type:String,
    maxlength:300
  }

},{ timestamps:true });

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);

```

### Two-Table Relationship Example

**Fee Tracking** (1 row per student — current status):

| Student | Total Fee | Paid | Balance | Status |
| --- | --- | --- | --- | --- |
| John | ₹50,000 | ₹30,000 | ₹20,000 | `PARTIAL` |

**Payment Transactions** (1 row per payment — full history):

| Transaction ID | Student | Amount | Date | Receipt |
| --- | --- | --- | --- | --- |
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
| --- | --- | --- | --- | --- |
| Initial | — | ₹0 | ₹50,000 | `NOT_PAID` |
| Payment 1 | ₹10,000 | ₹10,000 | ₹40,000 | `PARTIAL` |
| Payment 2 | ₹20,000 | ₹30,000 | ₹20,000 | `PARTIAL` |
| Payment 3 | ₹20,000 | ₹50,000 | ₹0 | `PAID` |

### Scenario 2 — Multiple Students, Same Fee Structure

| Student | Total Fee | Paid | Balance | Status |
| --- | --- | --- | --- | --- |
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
| --- | --- |
| Balance formula | `Balance = Total Fee − Total Paid` |
| Status on creation | Always `NOT_PAID` |
| Fee Structure mutability | Never modified — new version created |
| Transaction records | Append-only — never deleted or edited |
| Tracking record | Updated automatically after each payment |

---

*Document Version: 1.0 · Last Updated: February 16, 2026*