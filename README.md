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
src/
├── server.js                  # Entry point, middleware stack, route mounting
├── seed.js                    # Seed admin/superadmin users on startup
├── config/
│   └── db.js                  # MongoDB connection
├── middleware/
│   ├── authMiddleware.js      # JWT auth: protect, admin, superadmin
│   ├── corsMiddleware.js      # CORS configuration
│   └── errorHandler.js        # Centralized error handler
├── utils/
│   ├── AppError.js            # Custom error class with statusCode
│   ├── asyncHandler.js        # Async wrapper for controllers
│   ├── generateToken.js       # JWT token generation
│   ├── generateLedger.js      # Ledger generation utility
│   ├── sendMail.js            # Email service
│   └── templateHandler.js     # Email template handler
├── models/
│   └── ActivityLog.js         # Audit trail for mutations
└── api/
    ├── auth/                  # Login, logout, JWT
    ├── feeStructure/          # Fee structure master (superadmin)
    ├── students/              # Student CRUD + bulk import
    ├── studentFeeTracking/    # Fee summary, concessions, receipts
    ├── transaction/           # Payment recording + reports
    ├── hostel/                # Hostel blocks, rooms, fees
    └── transport/             # Transport routes, stops, fees
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
