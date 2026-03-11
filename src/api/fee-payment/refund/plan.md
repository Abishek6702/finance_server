Refund Handling Logic

1. Core Principle

Your system has three layers of truth:

Layer	Purpose
fee_transactions	Payment history
fee_refunds	Refund history
student_fee_tracking	Current ledger state

Rules:

Transactions and refunds are immutable records

Ledger (student_fee_tracking) is the computed state

Ledger is updated after every event.

2. Refund Module Responsibilities

The refund module must handle:

Validation

Ledger deduction

Refund record creation

Audit trail

Atomic transaction safety

3. Refund API
POST /refund/:rollNo

Example request

{
  "academicYear": "2024-2025",
  "semNumber": 3,
  "feeHead": "tuition",
  "refundAmount": 2000,
  "reason": "duplicate payment"
}
4. Fee Head Rules
Semester-based heads

Require semester:

tuition
exam
erp
book
lab

Location in ledger:

academic[odd/even][feeHead]
Non-semester heads

Do NOT require semester:

transport
hostel

Location:

transport.total
hostel.total
5. Semester Mapping Logic

Your schema stores semesters as odd / even, so map like this:

Semester	Ledger Block
1	odd
2	even
3	odd
4	even
5	odd
6	even
7	odd
8	even

Logic:

semesterKey = semNumber % 2 === 1 ? "odd" : "even"
6. Validation Layer

Before refund:

Student validation
student must exist
Academic year validation
academicYear must exist in academicYearWiseRecord
Fee head validation
feeHead must exist in schema
Refund amount validation
refundAmount > 0
refundAmount <= paid

Example rule:

if (refundAmount > component.paid)
   throw "Refund exceeds paid amount"
7. Refund Ledger Collection

Create a separate refund collection.

fee_refunds

Structure:

student
rollNo
academicYear
semesterNumber
feeHead
refundAmount
reason
refundReceiptNo
refundedBy
status
createdAt

Example document:

{
  "rollNo": "23CS109",
  "academicYear": "2024-2025",
  "semesterNumber": 3,
  "feeHead": "tuition",
  "refundAmount": 2000,
  "refundReceiptNo": "RF-2026-0012",
  "reason": "duplicate payment",
  "refundedBy": "userId"
}
8. Refund Execution Flow

Correct flow:

Step 1

Start MongoDB transaction

Step 2

Load ledger

StudentFeeTracking.findOne({rollNo})
Step 3

Locate correct component

Examples:

Academic

academic.odd.tuition

Transport

transport.total

Hostel

hostel.total
Step 4

Validate refund amount

refundAmount <= paid
Step 5

Reduce paid

component.paid -= refundAmount

Never modify:

subTotal
concession
total.total

Only modify:

paid
Step 6

Save ledger

Your pre-save hook recalculates

totals

status

year totals

semester totals

Step 7

Insert refund record

FeeRefund.create()
Step 8

Commit transaction

9. Refund Receipt Generation

Generate unique refund numbers:

RF-2026-00001
RF-2026-00002

Structure:

RF-{year}-{sequence}

Finance departments require this.

10. Refund History APIs
Get refunds by student
GET /refunds/student/:rollNo
Get refunds by academic year
GET /refunds/year/:academicYear
Admin refund report
GET /refunds/report

Filters:

date range
fee head
operator
department
11. Refund Restrictions (Important)

Do NOT allow refund if:

paid == 0

Do NOT allow refund if:

refundAmount > paid

Do NOT allow refund if:

academicYear closed
12. Accounting Integrity Rule

Refund must not create negative paid values.

Safe deduction:

component.paid = Math.max(0, component.paid - refundAmount)
13. Concurrency Safety

Two admins might refund simultaneously.

Solution:

Use MongoDB transactions + document lock

session.startTransaction()
14. Audit Requirements

Refund record must store:

who refunded
when refunded
why refunded
amount refunded

Without this your system will fail finance audit.

15. Final Module Structure
api
 └── refunds
      ├── controller.refund.js
      ├── service.refund.js
      ├── model.refund.js
      ├── routes.refund.js
      └── validation.refund.js
16. Ideal Refund Flow Diagram
Admin Request
      │
      ▼
Validate Input
      │
      ▼
Load Student Ledger
      │
      ▼
Validate Refund Amount
      │
      ▼
Deduct Paid
      │
      ▼
Save Ledger (pre-save recalculates totals)
      │
      ▼
Create Refund Record
      │
      ▼
Commit Transaction
17. One Major Improvement (Highly Recommended)

Right now your ledger does not track refund totals per fee head.

Later analytics like:

Total tuition refunds this year

will require aggregation.

Optional addition:

refundTotal

inside each component.

But not mandatory.