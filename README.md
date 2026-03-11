# QPulse Finance Backend

A comprehensive fee management system for educational institutions. Built with **Node.js**, **Express 5**, and **MongoDB/Mongoose 9**.

---

## Table of Contents

- [Architecture](#architecture) 
- [Database Schema](#database-schema) 
- [Getting Started](#getting-started)
- [Module Documentation](#module-documentation)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Postman Collection](#postman-collection)

---

## Architecture

```
backend/
├── .env
├── .gitignore
├── README.md
├── data.csv
├── find-recalls.js
├── m.json
├── package.json
├── package-lock.json
├── update-postman.js
└── src/
    ├── seed.js
    ├── server.js
    ├── api/
    │   ├── auth/
    │   │   ├── controller.auth.js
    │   │   ├── doc.auth.md
    │   │   ├── model.user.js
    │   │   ├── routes.auth.js
    │   │   ├── service.auth.js
    │   │   └── validation.auth.js
    │   ├── feedetails/
    │   │   ├── controller.feedetails.js
    │   │   ├── doc.feedetails.md
    │   │   ├── routes.feedetails.js
    │   │   ├── service.feedetails.js
    │   │   └── validation.feedetails.js
    │   ├── feePayments/
    │   │   ├── controller.feePayments.js
    │   │   ├── doc.feePayments.md
    │   │   ├── model.receiptCounter.js
    │   │   ├── model.studentFeePayments.js
    │   │   ├── routes.feePayments.js
    │   │   ├── service.feePayments.js
    │   │   └── validation.feePayments.js
    │   ├── feeStructure/
    │   │   ├── acadamic/
    │   │   │   ├── controller.acadamic.js
    │   │   │   ├── doc.acadamic.md
    │   │   │   ├── model.acadamic.js
    │   │   │   ├── new.doc.md
    │   │   │   ├── routes.acadamic.js
    │   │   │   ├── service.acadamic.js
    │   │   │   └── validation.acadamic.js
    │   │   ├── hostel/
    │   │   │   ├── controller.hostel.js
    │   │   │   ├── doc.hostel.md
    │   │   │   ├── model.hostel.js
    │   │   │   ├── routes.hostel.js
    │   │   │   ├── service.hostel.js
    │   │   │   └── validation.hostel.js
    │   │   └── transport/
    │   │       ├── controller.transport.js
    │   │       ├── doc.transport.md
    │   │       ├── model.transport.js
    │   │       ├── routes.transport.js
    │   │       ├── service.transport.js
    │   │       └── validation.transport.js
    │   ├── receiptRecall/
    │   │   ├── controller.receiptRecall.js
    │   │   ├── doc.receiptRecall.md
    │   │   ├── model.receiptRecall.js
    │   │   ├── routes.receiptRecall.js
    │   │   ├── service.receiptRecall.js
    │   │   └── validation.receiptRecall.js
    │   ├── reports/
    │   │   ├── controller.reports.js
    │   │   ├── doc.report.md
    │   │   ├── routes.reports.js
    │   │   ├── service.reports.js
    │   │   └── validation.reports.js
    │   ├── StudentFacilityManagement/
    │   │   ├── controller.StudentFacilityManagement.js
    │   │   ├── doc.StudentFacilityManagement.md
    │   │   ├── plan.md
    │   │   ├── routes.StudentFacilityManagement.js
    │   │   ├── service.StudentFacilityManagement.js
    │   │   └── validation.StudentFacilityManagement.js
    │   ├── studentFeeTracking/
    │   │   ├── controller.studentFeeTracking.js
    │   │   ├── doc.studentFeeTracking.md
    │   │   ├── model.studentFeeTracking.js
    │   │   ├── routes.studentFeeTracking.js
    │   │   ├── service.studentFeeTracking.js
    │   │   └── validation.studentFeeTracking.js
    │   ├── students/
    │   │   ├── controller.students.js
    │   │   ├── doc.students.md
    │   │   ├── model.student.js
    │   │   ├── routes.students.js
    │   │   ├── service.students.js
    │   │   ├── utils.bulkParse.js
    │   │   ├── utils.students.js
    │   │   └── validation.students.js
    │   └── superadmin/
    │       ├── controller.superadmin.js
    │       └── routes.superadmin.js
    ├── config/
    │   └── db.js
    ├── controllers/
    │   └── transactionController.js      ← legacy (pre-refactor)
    ├── data/                              ← empty
    ├── middleware/
    │   ├── authMiddleware.js
    │   ├── corsMiddleware.js
    │   └── errorHandler.js
    ├── models/
    │   └── ActivityLog.js
    ├── postman/
    │   ├── Postman Quick-Start Guide.md
    │   ├── Qpulse_Finance_API.postman_collection.json
    │   └── Qpulse_Finance_Local.postman_environment.json
    ├── routes/
    │   └── transactionRoutes.js          ← legacy (pre-refactor)
    ├── test/
    │   ├── auth.test.js
    │   ├── feedetails.test.js
    │   ├── feePayments.test.js
    │   ├── feeStructure.test.js
    │   ├── globalLifecycle.js
    │   ├── receiptRecall.test.js
    │   ├── reporter.js
    │   ├── reports.test.js
    │   ├── setup.js
    │   ├── StudentFacilityManagement.test.js
    │   ├── studentFeeTracking.test.js
    │   ├── students.test.js
    │   ├── studentsBulk.test.js
    │   └── test.js
    └── utils/
        ├── AppError.js
        ├── asyncHandler.js
        ├── generateLedger.js
        ├── generateToken.js
        ├── sendMail.js
        └── templateHandler.js

```

Each API module follows a consistent pattern:
- `model.*.js` — Mongoose schema & model
- `routes.*.js` — Express router with middleware
- `controller.*.js` — Request handlers (wrapped in `asyncHandler`)
- `service.*.js` — Business logic (throws `AppError` on failure)
- `validation.*.js` — Input validation middleware

---
 
## Database Schema

### Collections Overview

| Collection | Model | Key Fields |
|-----------|-------|------------|
| `users` | User | email (unique), password (hashed), role |
| `feestructuremasters` | FeeStructureMaster | academicYear (unique), academicStructures[], hostelStructures[] |
| `students` | Student | personal.rollNo (unique), academic, contact, family, enrollment, transport, hostel |
| `studentfeetrackings` | StudentFeeTracking | student (ref, unique), rollNo, academicYearWiseRecord[] |
| `studenttransactions` | StudentTransaction | student (ref, unique), rollNo, transactions[] |
| `hostels` | Hostel | block, sharing, isAttached (compound unique), fee |
| `transports` | Transport | route, busNo, stop (compound unique), fee |
| `activitylogs` | ActivityLog | user (ref), endpoint, method, before, after |
   
## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)

### Installation

```bash
git clone <repo-url>
cd backend
npm install
```

### Environment Variables

Create a `.env` file:

```env
MONGO_URI=mongodb://localhost:27017/qpulse_finance
JWT_SECRET=your_jwt_secret
```

### Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:5010`

### Running Tests

```bash
npm test
```

Runs 9 test suites with 275+ tests covering all modules.

---

## Module Documentation

Detailed API documentation for each module — request/response schemas, validation rules, edge cases, and full JSON examples.

| Module | Documentation |
|---|---|
| Auth | [src/api/auth/doc.auth.md](src/api/auth/doc.auth.md) |
| Fee Structure | [src/api/feeStructure/doc.feeStructure.md](src/api/feeStructure/doc.feeStructure.md) |
| Students | [src/api/students/doc.students.md](src/api/students/doc.students.md) |
| Student Fee Tracking | [src/api/studentFeeTracking/doc.studentFeeTracking.md](src/api/studentFeeTracking/doc.studentFeeTracking.md) |
| Transactions | [src/api/transaction/doc.transaction.md](src/api/transaction/doc.transaction.md) |
| Hostel | [src/api/hostel/doc.hostel.md](src/api/hostel/doc.hostel.md) |
| Transport | [src/api/transport/doc.transport.md](src/api/transport/doc.transport.md) |

---

## API Reference

All endpoints return standardized responses:

```json
{
  "success": true,
  "data": { ... },
  "message": "Description of result"
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "message": "Error description"
}
```
 
## Testing

The test suite uses **Jest 30** and **Supertest 7** with a shared setup:

RUN: npm test
 
All tests use isolated test data (timestamp-based) to avoid conflicts with production data.

---

## Postman Collection

Import `Qpulse_Finance_API.postman_collection.json` and `Qpulse_Finance_Local.postman_environment.json` into Postman.

### Environment Variables

| Variable | Default Value | Description |
|----------|--------------|-------------|
| `base_url` | `http://localhost:5010/api` | API base URL |
| `token` | *(auto-set on login)* | JWT auth token |
| `academic_year` | `2025-2026` | Current academic year |
| `batch_year` | `2025-2029` | Student batch range |
| `student_roll_no` | `25CS101` | Test student roll number |
| `receipt_no` | `REC-2025-001` | Test receipt number |

### Recommended Flow
1. Run **Login Superadmin** (auto-stores token)
2. Create a **Fee Structure**
3. Create a **Student**
4. Switch to **Login Admin**
5. **Record Payment**
6. View **Fee Summary**, **Recent Payments**, **Reports**
