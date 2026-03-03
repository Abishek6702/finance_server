# QPulse Finance Backend

A comprehensive fee management system for educational institutions. Built with **Node.js**, **Express 5**, and **MongoDB/Mongoose 9**.

---

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [Database Schema](#database-schema)
- [Application Flow](#application-flow)
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

## Modules

### 1. Auth
- JWT-based authentication with cookie + Bearer header support
- Three roles: `user`, `admin`, `superadmin`
- Seeded accounts: `admin@sece.ac.in` / `superadmin@sece.ac.in`

### 2. Fee Structure Master (Superadmin only)
- Hierarchical fee definition: Academic Year → Quota → Education Type → Department → Semester
- Per-semester breakdown: tuition, exam, ERP, book, lab
- Hostel fee structures: block, room type, sharing, attached bathroom
- Auto-computed totals via pre-validate hooks

### 3. Students Management (Superadmin only)
- Full CRUD for individual students
- Bulk create/update via CSV or Excel upload
- Student data: personal, academic, contact, family, address, enrollment, transport, hostel
- On creation: auto-generates `StudentFeeTracking` record with fee ledger

### 4. Student Fee Tracking (Admin+)
- Per-student, per-academic-year fee ledger with semester-level granularity
- Summary views with filters: name, rollNo, department, status, studentType
- Individual student detail with overall totals across all years
- Concession management (firstGraduate, scheme7.5%, PMSS, Sakthi)
- Receipt editing (paymentType, bankName, bankLocation, remarks)
- Audit logging via `ActivityLog` model

### 5. Payment Transactions (Admin+)
- Multi-component payment in single receipt (academic + hostel + transport)
- Overpayment prevention — validates against remaining due per component
- Payment modes: Cash, Card, UPI, NetBanking, Cheque, DD
- Recent payments with filters: name, rollNo, year, department, paymentMode, feeHead, date range
- **Reports:**
  - Individual student report — receipts with per-fee-head demand/paid/balance
  - Date-wise report — flattened rows sorted by date

### 6. Hostel
- Block-room type-fee mapping (A–F blocks, 2–5 sharing, attached/non-attached)
- Seeded with 48 configurations on startup
- Lookup by block → room types, or room type → blocks → fees

### 7. Transport
- Route-bus-stop-fee mapping
- Seeded with 9 routes and ~78 stop records on startup
- Lookup by route → stops, route → buses, or specific fee

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

### Entity Relationship

```
User (admin/superadmin)
  │
  ├──▶ FeeStructureMaster (defines fee template per academic year)
  │
  ├──▶ Student ◀──────────────────────────────────┐
  │      │                                         │
  │      ├──▶ StudentFeeTracking (1:1)             │
  │      │      └── academicYearWiseRecord[]       │
  │      │            ├── academic (odd/even sems)  │
  │      │            ├── hostel                    │
  │      │            ├── transport                 │
  │      │            └── concessions               │
  │      │                                          │
  │      └──▶ StudentTransaction (1:1)              │
  │             └── transactions[]                  │
  │                   └── breakdowns[]              │
  │                                                 │
  ├──▶ Hostel ◀─────────────────────────────────────┤
  │                                                 │
  └──▶ Transport ◀──────────────────────────────────┘
```

### Fee Tracking Structure (per student, per year)

```
academicYearWiseRecord
├── academicYear: "2025-2026"
├── academic
│   ├── odd (semester 1/3/5/7)
│   │   ├── tuition: { total, paid, status }
│   │   ├── exam: { total, paid, status }
│   │   ├── erp: { total, paid, status }
│   │   ├── book: { total, paid, status }
│   │   ├── lab: { total, paid, status }
│   │   └── total: { total, paid, status }
│   ├── even (semester 2/4/6/8)
│   │   └── (same as odd)
│   ├── academicSpecialConcession
│   └── total: { total, paid, status }
├── hostel
│   ├── block, sharing, isAttached, fee
│   ├── hostelSpecialConcession
│   └── total: { total, paid, status }
├── transport
│   ├── route, busNo, stop, fee
│   ├── transportSpecialConcession
│   └── total: { total, paid, status }
├── concessions
│   ├── firstGraduate, scheme7point5, pmss, sakthi
│   └── totalConcession
└── total: { total, paid, status }
```

---

## Application Flow

### Startup Sequence
1. Connect to MongoDB
2. Seed admin & superadmin users (if not exist)
3. Start Express server on port **5010**
4. Seed transport data (9 routes, ~78 stops)
5. Seed hostel data (48 block/room configurations)

### Fee Management Flow

```
1. Superadmin creates Fee Structure
   └── Defines fees per academic year, quota, department, semester + hostel

2. Superadmin creates Student (individual or bulk CSV/Excel)
   └── Auto-generates StudentFeeTracking with fee ledger
       └── Maps semester fees from FeeStructure to tracking record
       └── If hostel applicable → maps hostel fees
       └── If transport applicable → maps transport fees

3. Admin records Payment
   ├── Validates: rollNo exists, amounts don't exceed remaining due
   ├── Creates transaction record with receipt
   ├── Updates fee tracking (paid amounts, status per component)
   └── Status auto-transitions: Unpaid → Partially Paid → Paid

4. Admin views Reports
   ├── Fee Summary: aggregate view with filters
   ├── Individual Summary: per-student detail with overall totals
   ├── Recent Payments: filterable payment history
   ├── Student Report: receipt-level fee breakdown
   └── Datewise Report: chronological payment rows
```

### Authentication Flow
```
POST /api/auth/login { email, password }
  └── Returns JWT token (also set as httpOnly cookie)
      └── Include in subsequent requests:
          - Header: Authorization: Bearer <token>
          - Or: Cookie (automatic)
```

### Middleware Stack (request order)
1. `express.json()` — Parse JSON body
2. `cookieParser()` — Parse cookies
3. `corsMiddleware` — CORS headers
4. Route handlers
5. `notFoundHandler` — 404 for unmatched routes
6. `errorHandler` — Centralized error response

---

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

### Route Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login |
| POST | `/api/auth/logout` | User | Logout |
| POST | `/api/feeStructureMaster` | Superadmin | Create fee structure |
| GET | `/api/feeStructureMaster` | Superadmin | Get all fee structures |
| GET | `/api/feeStructureMaster/:year` | Superadmin | Get fee structure by year |
| PUT | `/api/feeStructureMaster/:year` | Superadmin | Update fee structure |
| DELETE | `/api/feeStructureMaster/:year` | Superadmin | Delete fee structure |
| POST | `/api/studentsManagement` | Superadmin | Create student |
| POST | `/api/studentsManagement/bulk` | Superadmin | Bulk create students |
| PUT | `/api/studentsManagement/bulk` | Superadmin | Bulk update students |
| GET | `/api/studentsManagement` | Superadmin | Get all students |
| GET | `/api/studentsManagement/:rollNo` | Superadmin | Get student by roll no |
| PUT | `/api/studentsManagement/:rollNo` | Superadmin | Update student |
| DELETE | `/api/studentsManagement/:rollNo` | Superadmin | Delete student | 
| GET | `/api/hostel` | Admin | Full hostel mapping |
| POST | `/api/hostel/blocks` | Superadmin | Get blocks |
| POST | `/api/hostel/roomTypes` | Superadmin | Get room types |
| POST | `/api/hostel/fees` | Superadmin | Get hostel fees |
| POST | `/api/hostel/add` | Superadmin | Add hostel entry |
| POST | `/api/hostel/bulk` | Superadmin | Bulk add hostel |
| PUT | `/api/hostel/:id` | Superadmin | Update hostel entry |
| GET | `/api/transport` | Admin | Full transport mapping |
| POST | `/api/transport/stops` | Superadmin | Get stops |
| POST | `/api/transport/buses` | Superadmin | Get buses |
| POST | `/api/transport/fees` | Superadmin | Get transport fees |
| POST | `/api/transport/add` | Superadmin | Add transport entry |
| POST | `/api/transport/bulk` | Superadmin | Bulk add transport |
| PUT | `/api/transport/:id` | Superadmin | Update transport entry |

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed request/response schemas.

---

## Testing

The test suite uses **Jest 30** and **Supertest 7** with a shared setup:

| Suite | File | Tests |
|-------|------|-------|
| Auth | `auth.test.js` | Login, logout, role validation |
| Fee Structure | `feeStructure.test.js` | CRUD, validation, cascading totals |
| Students | `students.test.js` | CRUD, validation, fee tracking auto-creation |
| Students Bulk | `studentsBulk.test.js` | CSV/Excel upload, merge, validation |
| Hostel | `hostel.test.js` | Lookup, add, bulk, update |
| Transport | `transport.test.js` | Lookup, add, bulk, update |
| Fee Tracking | `studentFeeTracking.test.js` | Summary, concessions, receipts |
| Transactions | `transaction.test.js` | Payments, overpayment prevention, filters |
| Reports | `reports.test.js` | Enhanced filters, student report, datewise report |

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
