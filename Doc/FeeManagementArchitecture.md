# Fee Management System - Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Components](#system-components)
3. [How It Works](#how-it-works)
4. [Workflows](#workflows)
5. [Key Concepts](#key-concepts)
6. [Common Scenarios](#common-scenarios)

---

## Overview

The Fee Management System handles all aspects of student fee collection in an educational institution. It automatically calculates fees, tracks payments, and maintains complete financial records for each student throughout their academic journey.

### What It Does

- **Stores institutional fee structures** for each academic year
- **Creates personalized fee records** for every student
- **Tracks payments** and outstanding balances
- **Applies concessions** and scholarships automatically
- **Updates fee records** when institutional fees change
- **Maintains transaction history** for audit purposes

### Why It Matters

Without this system, maintaining fee records manually would be:
- Time-consuming and error-prone
- Difficult to track across multiple years
- Hard to update when fee structures change
- Complex when applying various concessions
- Challenging to generate accurate reports

---

## System Components

### 1. Fee Structure Master

**What it is:** The official fee structure defined by the institution for each academic year.

**What it contains:**
- Academic fees (tuition, exam, books, lab, ERP) organized by:
  - Quota type (Government or Management)
  - Education level (UG or PG)
  - Degree program (BE, BTech, ME, MTech)
  - Department (CSE, ECE, Mechanical, etc.)
  - Semester (1 through 8)
- Transport fees by route and bus stop
- Hostel fees by block and room type

**Key feature:** Totals are calculated automatically at every level. Change any fee amount, and all higher-level totals update automatically.

**When it's used:** Referenced during student enrollment and when fee structures are updated.

---

### 2. Student

**What it is:** Complete profile of each student including personal, academic, and financial details.

**What it contains:**
- Personal information (name, roll number, contact details)
- Academic details (department, program, batch, current year)
- Enrollment information (quota, applicable schemes)
- Transport details (if student uses bus)
- Hostel details (if student is resident)
- Concession eligibility (First Graduate, 7.5% scheme, PMSS, Sakthi)

**Key feature:** When a new student is created, their fee ledger is automatically generated based on their profile.

**When it's used:** During admission, when updating student details, and as reference for fee calculations.

---

### 3. Student Fee Tracking

**What it is:** The personalized fee ledger for each student showing what they owe and what they've paid.

**What it contains:**
- Separate records for each academic year
- For each year:
  - Odd semester fees (broken down by type)
  - Even semester fees (broken down by type)
  - Transport fees (if applicable)
  - Hostel fees (if applicable)
  - Applied concessions
  - Payment status for each component

**Key feature:** Shows three values for each fee component:
- **Total:** How much is due
- **Paid:** How much has been paid
- **Status:** Unpaid, Partially Paid, or Paid (calculated automatically)

**When it's used:** Every time a payment is recorded, when checking outstanding dues, and when generating reports.

---

### 4. Student Transaction

**What it is:** Complete payment history for each student.

**What it contains:**
- List of all payments made
- For each payment:
  - Receipt number
  - Payment method (Cash, Card, UPI, etc.)
  - Date and time
  - Detailed breakdown showing which fees were paid
  - Bank details (if applicable)
  - Remarks

**Key feature:** Supports partial payments and payments that cover multiple fee types or even multiple academic years.

**When it's used:** When recording payments, generating receipts, and for financial audits.

---

## How It Works

### The Big Picture

```
Institution defines → Student enrolls → Ledger created → Payments recorded → Balance updated
      fee structure        →→→                 →→→              →→→              →→→
```

### Automatic Calculations

The system automatically handles complex calculations:

1. **Fee Structure Totals:**
   - Add up all semester fees for a department
   - Add up all departments for a program
   - Add up all programs for the institution
   - Include transport and hostel in institution total

2. **Student Ledger Totals:**
   - Apply special concessions to specific fee components
   - Calculate semester totals after component-level concessions
   - Apply yearly concessions (schemes) to academic total
   - Calculate final payable amount for the year

3. **Payment Status:**
   - Compare paid amount to total amount
   - Automatically set status based on comparison
   - Update higher-level totals when component fees are paid

### Smart Updates

When institutional fees change:
1. System finds all affected students
2. Takes a snapshot of their current payments
3. Regenerates their ledgers with new fee amounts
4. Restores all previously recorded payments
5. New outstanding balances reflect the updated fees

---

## Workflows

### 1. New Student Enrollment

**What happens:**

1. Admin enters student information (personal, academic, enrollment details)
2. System saves the student record
3. Automatic trigger activates
4. System determines how many years to generate (based on batch years remaining)
5. For each year:
   - Finds the fee structure for that year
   - Matches student's quota, program, department
   - Extracts applicable fees
   - Matches transport route (if student uses bus)
   - Matches hostel configuration (if student is resident)
   - Applies all eligible concessions
   - Calculates final amounts
6. Creates complete fee ledger showing all years
7. Creates empty transaction record ready for payments

**Result:** Student has a complete fee structure from enrollment to graduation, ready for payment tracking.

---

### 2. Recording a Payment

**What happens:**

1. Student makes payment at accounts office
2. Accounts staff opens student's record
3. Creates new transaction with:
   - Receipt number
   - Payment method
   - Amount paid
   - Breakdown of which fees are being paid
4. System validates:
   - Payment doesn't exceed outstanding amount
   - Breakdown adds up to total payment
5. Updates tracking record:
   - Increases "paid" amount for each fee component
   - Status automatically updates based on new paid amount
6. Saves transaction and updated tracking

**Result:** Student's payment is recorded, balance updated, and receipt can be generated.

---

### 3. Updating Fee Structure

**What happens:**

1. Admin modifies fee amounts in fee structure master
2. System detects the change
3. Identifies all students affected by this change (those in matching batches)
4. For each affected student:
   - Saves current payment data
   - Recalculates entire ledger with new fees
   - Restores payment data
   - New dues = new total - old payments
5. All student records now reflect updated fees

**Result:** Fee changes apply to all students automatically while preserving payment history.

---

### 4. Checking Outstanding Dues

**What happens:**

1. Admin requests report of students with pending fees
2. System queries all student tracking records
3. For each student, calculates: Outstanding = Total - Paid
4. Filters students where outstanding > 0
5. Sorts by amount or department as needed
6. Returns list with student details and amounts

**Result:** Clear report showing who owes how much.

---

## Key Concepts

### Academic Year vs Batch

- **Academic Year:** One year in the institution's calendar (e.g., 2024-2025)
- **Batch:** The cohort a student belongs to, spanning their entire program (e.g., 2024-2028 for a 4-year program)

**Important:** A student's ledger contains multiple academic years based on their batch duration.

---

### Two Types of Concessions

**Special Concessions:**
- Applied to specific fee components (tuition, transport, hostel)
- Applied at the semester or component level
- Example: 2000 reduction in transport fee

**Yearly Scheme Concessions:**
- Applied to the total academic fees for the year
- Includes: First Graduate, 7.5% scheme, PMSS, Sakthi
- Applied after calculating semester totals

**Calculation order:**
1. Calculate semester subtotal (tuition + exam + erp + book + lab)
2. Apply special concession to semester
3. Sum both semesters for academic subtotal
4. Apply yearly scheme concessions
5. Add transport and hostel (after their special concessions)

---

### Payment Status Calculation

The system automatically determines status:

- **Unpaid:** Paid amount = 0
- **Partially Paid:** Paid amount > 0 but < Total
- **Paid:** Paid amount >= Total

This applies at every level:
- Individual components (tuition, exam, etc.)
- Semester totals
- Academic year totals
- Transport and hostel
- Overall yearly total

---

### Multi-Year Ledgers

Each student's tracking record contains separate entries for each academic year they'll be in the institution.

**Example:** A student entering in 2024 for a 4-year BE program will have ledger entries for:
- 2024-2025 (Year 1)
- 2025-2026 (Year 2)
- 2026-2027 (Year 3)
- 2027-2028 (Year 4)

This allows:
- Advance payment for future years
- Clear visibility of total program cost
- Accurate tracking across the student's entire journey

---

### Ledger Generation Rules

**When ledgers are generated:**
- Automatically when a new student is created
- Manually when forced rebuild is triggered
- Automatically when fee structures are updated

**Important limitation:** 
If a fee structure is missing for any year in the student's batch, generation stops at that point. This ensures students only have ledgers for years where official fees have been defined.

---

## Common Scenarios

### Scenario 1: Student Pays Full Fee for One Semester

**Situation:** Student pays complete semester 1 fees in one go.

**Process:**
1. Record transaction with breakdown for semester 1
2. Update tracking: paid amounts equal total amounts for all semester 1 components
3. Status for semester 1 components changes to "Paid"
4. Semester total status changes to "Paid"
5. Year total status changes to "Partially Paid" (since semester 2 is still pending)

---

### Scenario 2: Student Pays Tuition Only

**Situation:** Student pays tuition fee but not other components.

**Process:**
1. Record transaction with breakdown showing only tuition payment
2. Update tracking: tuition paid equals tuition total
3. Status for tuition changes to "Paid"
4. Other components remain "Unpaid"
5. Semester total status is "Partially Paid"

---

### Scenario 3: Fee Structure Increases Mid-Year

**Situation:** Institution increases lab fees after some students have already paid.

**Process:**
1. Admin updates fee structure with new lab fee amount
2. System rebuilds ledgers for all affected students
3. Student A (hasn't paid lab fee):
   - Lab total increases
   - Outstanding increases
4. Student B (already paid old lab fee):
   - Lab total increases
   - Lab shows as "Partially Paid"
   - Can pay difference later or leave as credit

---

### Scenario 4: Student Changes Transport Route

**Situation:** Student switches to a different bus stop with different fees.

**Process:**
1. Admin updates student's transport details
2. Manual rebuild triggered for this student
3. Ledger regenerates with new transport fees
4. Previous transport payments preserved
5. If new route costs more: additional due created
6. If new route costs less: overpayment shows (can be adjusted)

---

### Scenario 5: Payment for Multiple Years

**Situation:** Student pays fees for both first and second year together.

**Process:**
1. Create one transaction with multiple breakdowns
2. Breakdown 1: Specify academic year 2024-2025 with amounts
3. Breakdown 2: Specify academic year 2025-2026 with amounts
4. System updates both years' tracking records
5. Both years show appropriate payment status

---

### Scenario 6: Checking All Students with Dues

**Situation:** Admin wants to identify students who haven't paid complete fees.

**Process:**
1. System checks all student tracking records
2. For each record, looks at current academic year
3. Calculates: Outstanding = Total - Paid
4. Lists all students where Outstanding > 0
5. Can be filtered by department, sorted by amount

---

### Scenario 7: Student Gets Additional Scholarship

**Situation:** Student receives new scholarship after ledger was created.

**Process:**
1. Admin updates student's enrollment concessions
2. Manual rebuild triggered for this student
3. Ledger regenerates with additional concession
4. Previous payments preserved
5. Outstanding amount decreases
6. May show overpayment if already paid more than new total

---

## Summary

The Fee Management System automates the complex task of managing student fees by:

- Maintaining official fee structures
- Creating personalized fee records for each student
- Tracking payments and calculating balances automatically
- Applying concessions correctly
- Handling fee structure changes gracefully
- Preserving complete payment history

All calculations happen automatically, reducing errors and saving time. The system handles complex scenarios like partial payments, multi-year tracking, and mid-stream fee changes while maintaining data accuracy.

---

**Last Updated:** February 18, 2026  
**Version:** 1.0.0
 