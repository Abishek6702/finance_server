# Fee Structure and Tracking Collection Overview

Based on the MongoDB schemas in the system, here is a detailed breakdown of how the **Academic, Hostel, Transport, and Student Fee Tracking** structures are designed and how collections/payments work.

---

## 1. Academic Fee Structure (`modelAcadamic.js`)
The academic fee structure defines the base fees for students based on their program, department, and semester. It follows a multi-level hierarchy:

* **Structure Master**: Bound to a specific `academicYear` (e.g., "2024-2025").
* **Academic Structures**: Broken down by:
  * `quota` (Management vs. Government Quota)
  * `educationType` (UG, PG)
  * `degreeProgram` (BE, BTech, ME, MTech)
* **Department Level**: Broken down by `departmentName` (CSE, IT, AIML, etc.) under the program.
* **Semester Level**: Contains an array of 8 semesters. Each semester tracks five distinct fee heads: **tuition, exam, erp, book, lab**.
* **Automation**: Mongoose `pre('validate')` hooks automatically propagate and calculate the `total.fee` at every level (Semantic -> Department -> Academic Structure -> Master).

---

## 2. Hostel Fee Structure (`modelHostel.js`)
Defines the flat fees for students opting for hostel accommodation.

* **Characteristics**: Depends on the `block` (A-F), `sharing` (2-5 persons), and `isAttached` (boolean for attached bathroom).
* **Auto ID Generation**: Uses a specific generated ID pattern: `<Sharing><Block><AttachedFlag>` (e.g., `3A1` means 3-sharing, A block, Attached).
* **Validation**: Ensures no duplicate configurations exist for the same block/sharing/attachment combination.

---

## 3. Transport Fee Structure (`modelTransport.js`)
Manages bus route fees for students using college transport.

* **Tracking Elements**: Tracks the `route` name, `busNo`, and specific `stop` name.
* **Fee Variation**: Fees vary dynamically based on the distance (which `stop` the student boards from).
* **Auto ID Generation**: Generates a predictable ID based on bus number and the stop name stripped of spaces/special characters (e.g., `1bharathiyaruniversity`).

---

## 4. Student Fee Tracking (`modelStudentFeeTracking.js`)
This is the **Ledger** for each student. It is the central source of truth for how much a student owes, how much they were discounted, and what they have paid.

* **Year-Wise Breakdown**: Contains an `academicYearWiseRecord` array tracking fees separately per academic year.
* **Components Tracked**:
  * **Academic Fees**: Tracks `odd` and `even` semesters. For each fee type (tuition, exam, erp, book, lab), it logs `concession`, `subTotal`, `total` (net amount after concession), `paid` amount, and compliance `status` ("Paid", "Partial", "Unpaid").
  * **Hostel**: Records the assigned hostel block, base fee, any `hostelSpecialConcession`, and recalculates totals.
  * **Transport**: Logs the assigned bus stop/route and its fee, accounting for transport concessions.
  * **Concessions**: A dedicated object globally tracking fee reductions granted to the student across all heads.
* **Complex Auto-Calculation (`pre('save')`)**: 
  * Automatically nets all values (`total = subTotal - concession`).
  * Sums up paid amounts against netted totals to dynamically assign statuses (`status = "Partial" / "Paid" / "Unpaid"`).
  * Enforces idempotency to avoid double counting concessions or payments.

---

## 5. Student Fee Collection / Payments (`modelStudentFeePayments.js`)
This model tracks the **actual transactional receipts** when a student pays their fees.

* **Student Transaction Master**: Links to a `Student` and holds an array of `transactions`.
* **Receipt Information**: Each payment record logs the `receiptNo`, `paymentType` (Cash, UPI, NetBanking, etc.), bank details if applicable, `billingDate`, and overall `totalAmount`.
* **Breakdowns Array**: To handle a single receipt spanning multiple fee types, it keeps an array of breakdowns. 
  * Each breakdown targets a specific `academicYear` and `semesterNumber`.
  * Inside the breakdown, there is an array of `feeHeads` that map the exact amount of money applied to specific categories (e.g., 50,000 to "tuition" and 10,000 to "hostel").
* **Process Flow**: Collecting a fee inserts a transaction log here, and simultaneously increments the `paid` values in the corresponding `StudentFeeTracking` ledger, which in turn auto-updates the "Paid/Partial/Unpaid" statuses.
