# Dashboard API Documentation

Base route: `/api/dashboard`

Authentication: `Authorization: Bearer <token>`

Access: `admin` and `superadmin`

## 1. Students Count

Endpoint: `GET /students-count?year=2025-2026`

Response:

```json
{
  "success": true,
  "data": {
    "totalStudents": 1240,
    "totalHostelers": 38,
    "totalDayscholars": 94,
    "totalTransporters": 12
  },
  "message": "Students count fetched successfully"
}
```

## 2. Department Distribution

Endpoint: `GET /department-distribution?year=2025-2026&dept=ECE`

Response:

```json
{
  "success": true,
  "data": {
    "totalMembers": 256,
    "Hostel": 112,
    "Dayscholar": 72,
    "Transport": 72
  },
  "message": "Department distribution fetched successfully"
}
```

## 3. Department-wise Paid / Unpaid

Endpoint: `GET /fees-status?year=2025-2026`

Response:

```json
{
  "success": true,
  "data": {
    "year": "2025-2026",
    "departments": [
      { "dept": "CSE", "paid": 120, "unpaid": 30 },
      { "dept": "ECE", "paid": 85, "unpaid": 20 },
      { "dept": "MECH", "paid": 70, "unpaid": 40 },
      { "dept": "IT", "paid": 150, "unpaid": 25 },
      { "dept": "CCE", "paid": 110, "unpaid": 35 },
      { "dept": "EEE", "paid": 80, "unpaid": 50 },
      { "dept": "AIDS", "paid": 150, "unpaid": 25 },
      { "dept": "AIML", "paid": 110, "unpaid": 35 },
      { "dept": "Cyber Security", "paid": 80, "unpaid": 50 },
      { "dept": "CSBS", "paid": 80, "unpaid": 50 }
    ]
  },
  "message": "Department fee status fetched successfully"
}
```
