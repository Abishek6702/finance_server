# QPulse Finance — API Documentation

All endpoints return:

```json
{
  "success": true | false,
  "data": <payload> | null,
  "message": "Description"
}
```

**Authentication:** Include JWT token via `Authorization: Bearer <token>` header or httpOnly cookie.

**Roles:**
- **Admin** — Can access fee tracking, payments, reports, hostel/transport write
- **Superadmin** — Can access everything Admin can + fee structure management + student management

---

## Table of Contents

- [Public APIs](#public-apis)
- [Superadmin APIs](#superadmin-apis)
- [Admin APIs](#admin-apis)

---

## Public APIs

> No authentication required.

---

### POST `/api/auth/login`

Login and receive JWT token.

**Request Body:**
```json
{
  "email": "admin@sece.ac.in",
  "password": "admin@123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | User password |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "683bf3c8a2e12c6f3f91d5a0",
      "name": "Admin",
      "email": "admin@sece.ac.in",
      "role": "admin"
    }
  },
  "message": "Login successful"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | "Email and password are required" |
| 401 | "Invalid credentials" |

---

### GET `/api/hostel`

Get full hostel block-room-fee mapping.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "683bf3d0a2e12c6f3f91d5b1",
      "block": "A",
      "sharing": 3,
      "isAttached": true,
      "fee": 65000
    }
  ],
  "message": "All hostel data fetched"
}
```

---

### POST `/api/hostel/blocks`

Get available blocks for a room type.

**Request Body:**
```json
{
  "sharing": 3,
  "isAttached": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": ["A", "B", "C", "D", "E", "F"],
  "message": "Blocks fetched"
}
```

---

### POST `/api/hostel/roomTypes`

Get room types available in a block.

**Request Body:**
```json
{
  "block": "A"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "sharing": 2, "isAttached": false },
    { "sharing": 2, "isAttached": true },
    { "sharing": 3, "isAttached": false },
    { "sharing": 3, "isAttached": true }
  ],
  "message": "Room types fetched"
}
```

---

### POST `/api/hostel/fees`

Get fee for a specific hostel configuration.

**Request Body:**
```json
{
  "block": "A",
  "sharing": 3,
  "isAttached": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "fee": 65000,
    "block": "A",
    "sharing": 3,
    "isAttached": true
  },
  "message": "Hostel fee fetched"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Hostel configuration not found" |

---

### GET `/api/transport`

Get full transport route-bus-stop-fee mapping.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "683bf3d0a2e12c6f3f91d5c0",
      "route": "Bharathiyar University",
      "busNo": "1",
      "stop": "Kinathukadavu",
      "fee": 15000
    }
  ],
  "message": "All transport data fetched"
}
```

---

### POST `/api/transport/stops`

Get stops on a route.

**Request Body:**
```json
{
  "route": "Bharathiyar University"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": ["Kinathukadavu", "Pollachi Bypass", "Udumalpet Bypass"],
  "message": "Stops fetched"
}
```

---

### POST `/api/transport/buses`

Get buses on a route.

**Request Body:**
```json
{
  "route": "Bharathiyar University"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": ["1", "2"],
  "message": "Buses fetched"
}
```

---

### POST `/api/transport/fees`

Get fee for a specific transport configuration.

**Request Body:**
```json
{
  "route": "Bharathiyar University",
  "stop": "Kinathukadavu"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "fee": 15000,
    "route": "Bharathiyar University",
    "stop": "Kinathukadavu"
  },
  "message": "Transport fee fetched"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Transport configuration not found" |

---

## Superadmin APIs

> Requires: `protect` + `superadmin` middleware.
> Superadmin can also access all Admin APIs below.

---

### POST `/api/auth/logout`

Logout (clear cookie).

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

---

### POST `/api/feeStructureMaster`

Create a fee structure for an academic year.

**Request Body:**
```json
{
  "academicYear": "2025-2026",
  "academicStructures": [
    {
      "quota": "Government Quota",
      "educationType": "UG",
      "degreeProgram": "BE",
      "departments": [
        {
          "departmentName": "CSE",
          "semesters": [
            {
              "semesterNumber": 1,
              "tuition": { "fee": 40000 },
              "exam": { "fee": 2000 },
              "erp": { "fee": 500 },
              "book": { "fee": 1000 },
              "lab": { "fee": 1500 },
              "total": { "fee": 45000 },
              "isActive": true
            }
          ],
          "total": { "fee": 388000 },
          "isActive": true
        }
      ],
      "total": { "fee": 388000 },
      "isActive": true
    }
  ],
  "hostelStructures": [
    {
      "block": "A-BLOCK",
      "roomType": { "sharingType": "Three", "isAttached": true },
      "roomFee": { "fee": 30000 },
      "messFee": { "fee": 18000 },
      "maintenanceFee": { "fee": 5000 },
      "total": { "fee": 53000 },
      "isActive": true
    }
  ],
  "total": { "fee": 441000 },
  "isActive": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `academicYear` | string | Yes | Format: `YYYY-YYYY`, unique |
| `academicStructures` | array | Yes | Min 1 item |
| `academicStructures[].quota` | string | Yes | `"Government Quota"` or `"Management Quota"` |
| `academicStructures[].educationType` | string | Yes | `"UG"` or `"PG"` |
| `academicStructures[].degreeProgram` | string | Yes | `"BE"`, `"BTech"`, `"ME"`, `"MTech"` |
| `academicStructures[].departments[].departmentName` | string | Yes | `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL` |
| `academicStructures[].departments[].semesters` | array | Yes | Exactly 8 semesters |
| `hostelStructures` | array | No | Optional hostel fee definitions |

**Response (201):**
```json
{
  "success": true,
  "data": { "...created fee structure object..." },
  "message": "Fee structure created successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | "academicYear is required" / validation errors |
| 409 | "Fee structure for this academic year already exists" |

---

### GET `/api/feeStructureMaster`

Get all fee structures.

**Query Parameters:** None

**Response (200):**
```json
{
  "success": true,
  "data": [ { "...fee structure objects..." } ],
  "message": "All fee structures fetched successfully"
}
```

---

### GET `/api/feeStructureMaster/:academicYear`

Get fee structure for a specific year.

**Path Parameters:**

| Param | Example | Description |
|-------|---------|-------------|
| `academicYear` | `2025-2026` | Academic year in `YYYY-YYYY` format |

**Response (200):**
```json
{
  "success": true,
  "data": { "...fee structure object..." },
  "message": "Fee structure fetched successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Fee structure not found for this academic year" |

---

### PUT `/api/feeStructureMaster/:academicYear`

Update fee structure. Body same as POST.

**Response (200):**
```json
{
  "success": true,
  "data": { "...updated fee structure..." },
  "message": "Fee structure updated successfully"
}
```

---

### DELETE `/api/feeStructureMaster/:academicYear`

Delete fee structure by academic year.

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Fee structure deleted successfully"
}
```

---

### POST `/api/studentsManagement`

Create a single student. Auto-generates `StudentFeeTracking` with fee ledger.

**Request Body:**
```json
{
  "personal": {
    "rollNo": "25CS101",
    "studentName": "John Doe",
    "gender": "Male",
    "dob": "2007-05-15",
    "bloodGroup": "O+",
    "aadharNo": "999988887777",
    "emisNo": "EMIS001",
    "religion": "Hindu",
    "community": "BC",
    "casteName": "Kongu Vellalar",
    "nationality": "Indian",
    "studentPhoto": "https://example.com/photo.jpg"
  },
  "academic": {
    "educationType": "UG",
    "academicType": "REG",
    "isLateralEntry": false,
    "degreeProgram": "BE",
    "departmentName": "CSE",
    "yearStudying": 1,
    "currentSemesterNumber": 1,
    "section": "A",
    "batch": "2025-2029",
    "currentAcademicYear": "2025-2026"
  },
  "contact": {
    "selfMobileNo": "9876543210",
    "selfEmail": "john@mail.com",
    "officialEmail": "25cs101@sece.ac.in"
  },
  "family": {
    "father": { "name": "Father", "mobile": "9876500001", "workType": "Farmer", "qualification": "Diploma" },
    "mother": { "name": "Mother", "mobile": "9876500002", "workType": "Homemaker", "qualification": "HSC" },
    "guardian": { "name": "Guardian", "mobile": "9876500003" },
    "familyIncomeAsPerCertificate": 180000,
    "communityCertificateNo": "CC12345678"
  },
  "address": {
    "permanent": { "doorNo": "12/4", "street": "Main Road", "taluk": "Pollachi", "district": "Coimbatore", "state": "Tamil Nadu", "pincode": "641001" },
    "communication": { "doorNo": "12/4", "street": "Main Road", "taluk": "Pollachi", "district": "Coimbatore", "state": "Tamil Nadu", "pincode": "641001" }
  },
  "enrollment": {
    "quota": "Government Quota",
    "firstGraduate": { "isApplicable": false, "concessionAmount": 0 },
    "scheme7point5": { "isApplicable": false, "concessionAmount": 0 },
    "pmssScheme": { "isApplicable": false, "concessionAmount": 0 },
    "sakthiScheme": { "isApplicable": false, "concessionAmount": 0 },
    "specialConcession": { "isApplicable": false, "transport": 0, "hostel": 0, "tuition": 0 }
  },
  "transport": { "isApplicable": false },
  "hostel": { "isApplicable": false }
}
```

**Variant — Student with Hostel:**
```json
{
  "...same as above...",
  "hostel": {
    "isApplicable": true,
    "block": "A",
    "sharing": 3,
    "isAttached": true
  }
}
```

**Variant — Student with Transport:**
```json
{
  "...same as above...",
  "transport": {
    "isApplicable": true,
    "route": "Bharathiyar University",
    "stopName": "Kinathukadavu"
  }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `personal.rollNo` | string | Yes | Format: `DDLLNNN` (e.g., `25CS101`), unique |
| `academic.batch` | string | Yes | Format: `YYYY-YYYY` |
| `academic.currentAcademicYear` | string | Yes | Format: `YYYY-YYYY` |
| `academic.departmentName` | string | Yes | Must exist in fee structure |
| `enrollment.quota` | string | Yes | Must match fee structure quota |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "student": { "...student object..." },
    "feeTracking": { "...auto-generated fee tracking..." }
  },
  "message": "Student created successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation errors |
| 409 | "Student with this roll number already exists" |
| 404 | "Fee structure not found for academic year YYYY-YYYY" |

---

### POST `/api/studentsManagement/bulk`

Bulk create students from CSV or Excel file.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | `.csv` or `.xlsx` file with student data |

**CSV/Excel Headers (all required):**
```
rollNo, studentName, gender, dob, bloodGroup, aadharNo, emisNo,
religion, community, casteName, nationality, studentPhoto,
educationType, academicType, isLateralEntry, departmentName,
degreeProgram, yearStudying, currentSemesterNumber, section,
batch, currentAcademicYear,
selfMobileNo, selfEmail, officialEmail,
fatherName, fatherMobile, fatherWorkType, fatherQualification,
motherName, motherMobile, motherWorkType, motherQualification,
guardianName, guardianMobile,
familyIncomeAsPerCertificate, communityCertificateNo,
permDoorNo, permStreet, permTaluk, permDistrict, permState, permPincode,
commDoorNo, commStreet, commTaluk, commDistrict, commState, commPincode,
quota,
firstGraduateApplicable, firstGraduateConcession,
scheme7point5Applicable, scheme7point5Concession,
pmssApplicable, pmssConcession,
sakthiApplicable, sakthiConcession,
specialApplicable, specialTransport, specialHostel, specialTuition,
transportApplicable, transportRoute, transportStop,
hostelApplicable, hostelBlock, hostelSharing, hostelAttached
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "created": 3,
    "errors": []
  },
  "message": "Bulk student creation completed"
}
```

---

### PUT `/api/studentsManagement/bulk`

Bulk update students from CSV or Excel file. Same file format as bulk create.

**Request:** `multipart/form-data` with `file` field.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "errors": []
  },
  "message": "Bulk student update completed"
}
```

---

### GET `/api/studentsManagement`

Get all students.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `department` | string | Filter by department name |
| `year` | number | Filter by year of study |

**Response (200):**
```json
{
  "success": true,
  "data": [ { "...student objects..." } ],
  "message": "Students fetched successfully"
}
```

---

### GET `/api/studentsManagement/:rollNo`

Get student by roll number.

**Response (200):**
```json
{
  "success": true,
  "data": { "...student object..." },
  "message": "Student fetched successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Student not found" |

---

### PUT `/api/studentsManagement/:rollNo`

Update student. Body contains only fields to update.

**Response (200):**
```json
{
  "success": true,
  "data": { "...updated student..." },
  "message": "Student updated successfully"
}
```

---

### DELETE `/api/studentsManagement/:rollNo`

Delete student and associated fee tracking + transactions.

**Response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Student deleted successfully"
}
```

---

## Admin APIs

> Requires: `protect` + `admin` middleware.
> Both Admin and Superadmin can access these.

---

### POST `/api/feePayment/pay`

Record a payment for a student.

**Request Body:**
```json
{
  "rollNo": "25CS101",
  "receiptNo": "REC-2025-001",
  "paymentType": "Cash",
  "bankName": "Indian Bank",
  "bankLocation": "Kinathukadavu",
  "remarks": "Semester 1 partial payment",
  "breakdowns": [
    {
      "academicYear": "2025-2026",
      "academic": {
        "semesterNumber": 1,
        "tuition": 20000,
        "exam": 2000,
        "erp": 500,
        "book": 1000,
        "lab": 1500
      },
      "hostel": 0,
      "transport": 0
    }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `rollNo` | string | Yes | Must exist in system |
| `receiptNo` | string | Yes | Non-empty |
| `paymentType` | string | Yes | `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `bankName` | string | No | — |
| `bankLocation` | string | No | — |
| `remarks` | string | No | — |
| `breakdowns` | array | Yes | Min 1 item |
| `breakdowns[].academicYear` | string | Yes | Format: `YYYY-YYYY` |
| `breakdowns[].academic.semesterNumber` | number | No | 1–8 |
| `breakdowns[].academic.tuition` | number | No | Must not exceed remaining due |
| `breakdowns[].academic.exam` | number | No | Must not exceed remaining due |
| `breakdowns[].academic.erp` | number | No | Must not exceed remaining due |
| `breakdowns[].academic.book` | number | No | Must not exceed remaining due |
| `breakdowns[].academic.lab` | number | No | Must not exceed remaining due |
| `breakdowns[].hostel` | number | No | Must not exceed remaining due; student must have hostel |
| `breakdowns[].transport` | number | No | Must not exceed remaining due; student must have transport |

**Variant — Hostel + Academic payment:**
```json
{
  "rollNo": "25CS102",
  "receiptNo": "REC-2025-002",
  "paymentType": "DD",
  "bankName": "SBI",
  "breakdowns": [
    {
      "academicYear": "2025-2026",
      "academic": { "semesterNumber": 1, "tuition": 10000 },
      "hostel": 25000
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "683c...",
    "student": "683b...",
    "rollNo": "25CS101",
    "transactions": [
      {
        "receiptNo": "REC-2025-001",
        "paymentType": "Cash",
        "bankName": "Indian Bank",
        "bankLocation": "Kinathukadavu",
        "paidOn": "2025-06-01T10:30:00.000Z",
        "remarks": "Semester 1 partial payment",
        "breakdowns": [
          {
            "academicYear": "2025-2026",
            "academic": { "semesterNumber": 1, "tuition": 20000, "exam": 2000, "erp": 500, "book": 1000, "lab": 1500 },
            "hostel": 0,
            "transport": 0,
            "total": 25000
          }
        ],
        "totalAmount": 25000
      }
    ]
  },
  "message": "Payment recorded successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | "rollNo is required" |
| 400 | "receiptNo is required" |
| 400 | "paymentType must be one of: Cash, Card, UPI..." |
| 400 | "breakdowns must be a non-empty array" |
| 400 | "tuition payment ₹50000 exceeds remaining due ₹40000..." |
| 400 | "Total payment amount must be greater than 0" |
| 404 | "Fee tracking not found for this student" |
| 404 | "Academic year 2030-2031 not found in fee tracking" |
| 404 | "No hostel fee record found for 2025-2026" |
| 404 | "No transport fee record found for 2025-2026" |

---

### GET `/api/feePayment/recent`

Get recent payments with optional filters. **Serves: Payment Home Page.**

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Filter by student name (regex, case-insensitive) |
| `rollNo` | string | — | Filter by roll number (exact match, case-insensitive) |
| `year` | string | — | Filter by academic year (e.g., `2025-2026`) |
| `department` | string | — | Filter by department (exact match, case-insensitive) |
| `paymentMode` | string | — | Filter by payment type: `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `feeHead` | string | — | Filter by fee component: `tuition`, `exam`, `erp`, `book`, `lab`, `hostel`, `transport` |
| `fromDate` | ISO string | — | Filter payments on or after this date |
| `toDate` | ISO string | — | Filter payments on or before this date |
| `limit` | number | 50 | Maximum rows to return |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rollNo": "25CS101",
      "transaction": {
        "receiptNo": "REC-2025-001",
        "paymentType": "Cash",
        "bankName": "Indian Bank",
        "bankLocation": "Kinathukadavu",
        "paidOn": "2025-06-01T10:30:00.000Z",
        "remarks": "Semester 1 partial payment",
        "breakdowns": [
          {
            "academicYear": "2025-2026",
            "academic": { "semesterNumber": 1, "tuition": 20000, "exam": 2000, "erp": 500, "book": 1000, "lab": 1500 },
            "hostel": 0,
            "transport": 0,
            "total": 25000
          }
        ],
        "totalAmount": 25000
      },
      "studentDetails": {
        "name": "John Doe",
        "department": "CSE",
        "year": 1,
        "photo": "https://example.com/photo.jpg"
      }
    }
  ],
  "message": "Recent payments fetched successfully"
}
```

---

### GET `/api/feePayment/summary`

Get fee summary table for an academic year. **Serves: Fee Details Home Page.**

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | string | `2025-2026` | Academic year |
| `name` | string | — | Filter by student name (regex) |
| `rollNo` | string | — | Filter by roll number (regex) |
| `department` | string | — | Filter by department (regex) |
| `status` | string | — | Filter by status: `Paid`, `Partially Paid`, `Unpaid` |
| `studentType` | string | — | Filter by type: `hosteler`, `dayscholar`, `transport` |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "aggregate": {
      "totalStudents": 150,
      "totalDemand": 6750000,
      "totalCollection": 3200000,
      "totalOverdue": 3550000
    },
    "records": [
      {
        "rollNo": "25CS101",
        "studentDetails": {
          "name": "John Doe",
          "department": "CSE",
          "year": 1,
          "photo": "https://example.com/photo.jpg",
          "community": "BC"
        },
        "demand": 45000,
        "concession": 0,
        "paid": 25000,
        "overdue": 20000,
        "status": "Partially Paid",
        "studentType": {
          "isHosteler": false,
          "usesTransport": false,
          "isDayScholar": true
        }
      }
    ]
  },
  "message": "Fee summary fetched successfully"
}
```

---

### GET `/api/feePayment/summary/:rollNo`

Get detailed fee summary for a specific student. **Serves: Fee Details/:id Page.**

**Path Parameters:**

| Param | Example | Description |
|-------|---------|-------------|
| `rollNo` | `25CS101` | Student roll number |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "studentProfile": {
      "personal": {
        "rollNo": "25CS101",
        "studentName": "John Doe",
        "community": "BC",
        "gender": "Male"
      },
      "academic": {
        "departmentName": "CSE",
        "yearStudying": 1,
        "batch": "2025-2029",
        "currentAcademicYear": "2025-2026"
      },
      "contact": {
        "selfMobileNo": "9876543210",
        "selfEmail": "john@mail.com"
      }
    },
    "feeSummaryRecords": [
      {
        "academicYear": "2025-2026",
        "demand": 45000,
        "concession": 0,
        "paid": 25000,
        "overdue": 20000,
        "status": "Partially Paid",
        "fine": 0,
        "studentType": {
          "isHosteler": false,
          "usesTransport": false,
          "isDayScholar": true
        },
        "yearRecordDetails": { "...full year record..." }
      }
    ],
    "overallTotals": {
      "demand": 45000,
      "concession": 0,
      "paid": 25000,
      "fine": 0,
      "overdue": 20000,
      "status": "Partially Paid"
    }
  },
  "message": "Student fee summary fetched successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Fee tracking not found for this student" |

---

### GET `/api/feePayment/students`

Get student list for filter/search dropdowns. **Serves: Reports Individual Student List.**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `name` | string | Filter by student name (regex) |
| `rollNo` | string | Filter by roll number (regex) |
| `department` | string | Filter by department (exact, case-insensitive) |
| `year` | number | Filter by year of study |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rollNo": "25CS101",
      "name": "John Doe",
      "department": "CSE",
      "year": 1,
      "photo": "https://example.com/photo.jpg"
    }
  ],
  "message": "Students fetched successfully"
}
```

---

### GET `/api/feePayment/:rollNo`

Get all transactions for a student.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "683c...",
    "student": { "...populated student..." },
    "rollNo": "25CS101",
    "transactions": [
      {
        "receiptNo": "REC-2025-001",
        "paymentType": "Cash",
        "bankName": "Indian Bank",
        "paidOn": "2025-06-01T10:30:00.000Z",
        "breakdowns": [ "..." ],
        "totalAmount": 25000
      }
    ]
  },
  "message": "Transactions fetched successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Transactions not found for this student" |

---

### GET `/api/feePayment/reports/student/:rollNo`

Individual student report — receipts with per-fee-head demand/paid/balance breakdown. **Serves: Reports Individual/:id Page.**

**Path Parameters:**

| Param | Example | Description |
|-------|---------|-------------|
| `rollNo` | `25CS101` | Student roll number |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "student": {
      "rollNo": "25CS101",
      "name": "John Doe",
      "department": "CSE",
      "year": 1
    },
    "receipts": [
      {
        "receiptNo": "REC-2025-001",
        "academicYear": "2025-2026",
        "semesterNumber": 1,
        "semesterPeriod": "Odd",
        "paymentDate": "2025-06-01T10:30:00.000Z",
        "paymentMode": "Cash",
        "bankName": "Indian Bank",
        "totalAmount": 25000,
        "feeBreakdown": [
          {
            "feeHead": "Academic",
            "subHead": "tuition",
            "demand": 40000,
            "paid": 20000,
            "balance": 20000
          },
          {
            "feeHead": "Academic",
            "subHead": "exam",
            "demand": 2000,
            "paid": 2000,
            "balance": 0
          },
          {
            "feeHead": "Academic",
            "subHead": "erp",
            "demand": 500,
            "paid": 500,
            "balance": 0
          },
          {
            "feeHead": "Academic",
            "subHead": "book",
            "demand": 1000,
            "paid": 1000,
            "balance": 0
          },
          {
            "feeHead": "Academic",
            "subHead": "lab",
            "demand": 1500,
            "paid": 1500,
            "balance": 0
          }
        ]
      }
    ]
  },
  "message": "Student report fetched successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | "Student not found" |

---

### GET `/api/feePayment/reports/datewise`

Date-wise payment report — flattened rows sorted by date. **Serves: Reports Date-wise Page.**

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `academicYear` | string | — | Filter by academic year |
| `fromDate` | ISO string | — | Filter payments on or after this date |
| `toDate` | ISO string | — | Filter payments on or before this date |
| `limit` | number | 100 | Maximum rows to return |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rollNo": "25CS101",
      "studentName": "John Doe",
      "department": "CSE",
      "year": 1,
      "academicYear": "2025-2026",
      "semesterNumber": 1,
      "semesterPeriod": "Odd",
      "feeHead": {
        "tuition": 20000,
        "exam": 2000,
        "erp": 500,
        "book": 1000,
        "lab": 1500,
        "hostel": 0,
        "transport": 0
      },
      "amount": 25000,
      "date": "2025-06-01T10:30:00.000Z",
      "paymentMode": "Cash",
      "bankName": "Indian Bank",
      "receiptNo": "REC-2025-001"
    }
  ],
  "message": "Date-wise report fetched successfully"
}
```

---

### PUT `/api/feePayment/receipt/:receiptNo`

Update receipt metadata (does not change amounts).

**Path Parameters:**

| Param | Example | Description |
|-------|---------|-------------|
| `receiptNo` | `REC-2025-001` | Receipt number |

**Request Body (all fields optional, at least one required):**
```json
{
  "paymentType": "Card",
  "bankName": "SBI",
  "bankLocation": "Chennai",
  "remarks": "Updated to card payment"
}
```

| Field | Type | Validation |
|-------|------|------------|
| `paymentType` | string | `Cash`, `Card`, `UPI`, `NetBanking`, `Cheque`, `DD` |
| `bankName` | string | Non-empty |
| `bankLocation` | string | Non-empty |
| `remarks` | string | Non-empty |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "receiptNo": "REC-2025-001",
    "paymentType": "Card",
    "bankName": "SBI",
    "bankLocation": "Chennai",
    "remarks": "Updated to card payment",
    "paidOn": "2025-06-01T10:30:00.000Z",
    "breakdowns": [ "..." ],
    "totalAmount": 25000
  },
  "message": "Receipt updated successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | "At least one field must be provided" |
| 400 | "paymentType must be one of: Cash, Card, UPI..." |
| 404 | "Transaction not found" |

---

### PUT `/api/feePayment/concession/:rollNo/:academicYear`

Update concession amounts for a student in a specific academic year.

**Path Parameters:**

| Param | Example | Description |
|-------|---------|-------------|
| `rollNo` | `25CS101` | Student roll number |
| `academicYear` | `2025-2026` | Academic year |

**Request Body:**
```json
{
  "concessions": {
    "firstGraduate": 5000,
    "scheme7point5": 2500,
    "pmss": 1000,
    "sakthi": 500
  }
}
```

| Field | Type | Validation |
|-------|------|------------|
| `concessions` | object | Required, at least one field |
| `concessions.firstGraduate` | number | >= 0, max 2 decimal places |
| `concessions.scheme7point5` | number | >= 0, max 2 decimal places |
| `concessions.pmss` | number | >= 0, max 2 decimal places |
| `concessions.sakthi` | number | >= 0, max 2 decimal places |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "firstGraduate": 5000,
    "scheme7point5": 2500,
    "pmss": 1000,
    "sakthi": 500,
    "totalConcession": 9000
  },
  "message": "Concession updated successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | "concessions object is required" |
| 400 | "Concession values cannot be negative" |
| 400 | "Concession values must have at most 2 decimal places" |
| 404 | "Fee tracking not found for this student" |
| 404 | "Academic year record not found" |

---

### POST `/api/hostel/add`

Add a new hostel configuration.

**Request Body:**
```json
{
  "block": "A",
  "sharing": 3,
  "isAttached": true,
  "fee": 65000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `block` | string | Yes | A–F |
| `sharing` | number | Yes | 2, 3, 4, or 5 |
| `isAttached` | boolean | Yes | — |
| `fee` | number | Yes | >= 0 |

**Response (201):**
```json
{
  "success": true,
  "data": { "...hostel entry..." },
  "message": "Hostel entry added successfully"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation errors |
| 409 | "Hostel configuration already exists" |

---

### POST `/api/hostel/bulk`

Bulk add hostel configurations.

**Request Body:**
```json
{
  "entries": [
    { "block": "A", "sharing": 2, "isAttached": false, "fee": 48000 },
    { "block": "A", "sharing": 2, "isAttached": true, "fee": 55000 }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { "inserted": 2 },
  "message": "Bulk hostel entries added"
}
```

---

### PUT `/api/hostel/:id`

Update a hostel entry's fee.

**Request Body:**
```json
{
  "fee": 70000
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "...updated hostel entry..." },
  "message": "Hostel entry updated successfully"
}
```

---

### POST `/api/transport/add`

Add a new transport configuration.

**Request Body:**
```json
{
  "route": "Bharathiyar University",
  "busNo": "1",
  "stop": "New Stop",
  "fee": 14000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `route` | string | Yes | Non-empty |
| `busNo` | string | Yes | Non-empty |
| `stop` | string | Yes | Non-empty |
| `fee` | number | Yes | >= 0 |

**Response (201):**
```json
{
  "success": true,
  "data": { "...transport entry..." },
  "message": "Transport entry added successfully"
}
```

---

### POST `/api/transport/bulk`

Bulk add transport configurations.

**Request Body:**
```json
{
  "entries": [
    { "route": "New Route", "busNo": "10", "stop": "Stop A", "fee": 12000 },
    { "route": "New Route", "busNo": "10", "stop": "Stop B", "fee": 14000 }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { "inserted": 2 },
  "message": "Bulk transport entries added"
}
```

---

### PUT `/api/transport/:id`

Update a transport entry.

**Request Body:**
```json
{
  "fee": 16000,
  "stop": "Updated Stop Name"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "...updated transport entry..." },
  "message": "Transport entry updated successfully"
}
```
