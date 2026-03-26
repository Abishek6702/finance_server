# Fee Demand Module — API Documentation

## GET `/api/feedemands`

Returns fee demand list with optional filters.

### Query params
- `rollNo` (optional, alphanumeric)
- `batch` (optional, `YYYY-YYYY`)
- `department` (optional, one of `CSE`, `IT`, `AIML`, `AIDS`, `ECE`, `EEE`, `MECH`, `CIVIL`)
- `academicYear` (optional, `YYYY-YYYY`)
- `studyingYear` (optional, `1` to `4`)

### Response
- `success: true`
- `data: []`
- `pagination.totalRecords`
- `message: "Fee details fetched successfully"`

---

## GET `/api/feedemands/:rollNo?academicYear=YYYY-YYYY`

Returns student profile and student-type demand details for one required academic year.

### Path params
- `rollNo` (required, alphanumeric)

### Query params
- `academicYear` (required, `YYYY-YYYY`)

### Validation
- Missing `academicYear` → `400` (`academicYear query is required`)
- Invalid `academicYear` format → `400`
- Invalid `rollNo` format → `400`
- Student not found → `404`
- No fee tracking for that `academicYear` → `404`

### Response (200)
```json
{
  "success": true,
  "data": {
    "rollNo": "25CS150",
    "name": "Arun Prakash",
    "photo": "https://example.com/student-photo.jpg",
    "department": "CSE",
    "section": "B",
    "batch": "2025-2029",
    "currentAcademicYear": "2025-2026",
    "studentType": {
      "transport": true,
      "hostel": false,
      "transportDetails": {
        "transport": "College Bus",
        "route": "Route A",
        "busNo": "BUS-12",
        "stop": "Main Stop",
        "fee": 12000,
        "paid": 2000,
        "consession": 500
      },
      "hostelDetails": null
    }
  },
  "message": "Student fee demand fetched successfully"
}
```
