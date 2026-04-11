# Student Facility Management API

Base path: /api/studentFacility

Authentication:
- All endpoints require protect + admin middleware.

## Endpoints

1. PUT /api/studentFacility/assign/:rollNo
2. PUT /api/studentFacility/cancel/:rollNo
3. PUT /api/studentFacility/cancel-assign/:rollNo
4. GET /api/studentFacility/transfer/:transferId

## 1) Assign Facility

Endpoint: PUT /api/studentFacility/assign/:rollNo

Purpose:
- Assign hostel and/or transport facility for a student.
- Updates Student profile and StudentFeeTracking records from applyFromAcademicYear onward.

Sample body:

```json
{
  "facilityType": "transport",
  "effectiveDate": "2025-07-01",
  "reduction": 1200,
  "transport": {
    "isApplicable": true,
    "id": "67f5ea94ee7b84a3c89d1b4a"
  },
  "applyFromAcademicYear": "2025-2026"
}
```

Key rules:
- rollNo path param is required.
- applyFromAcademicYear must be valid and within student batch range.
- At least one of hostel or transport must be provided.
- For assign endpoint, provided facility payload must contain isApplicable: true and id.

Success:
- 200 with updated student data and tracking updates.

## 2) Cancel Facility

Endpoint: PUT /api/studentFacility/cancel/:rollNo

Purpose:
- Cancel one facility and settle paid amounts through refund flow.

Sample body:

```json
{
  "facilityType": "hostel",
  "applyFromAcademicYear": "2025-2026",
  "endDate": "2025-09-30",
  "conceptionAmount": 5000,
  "refundMode": "wallet"
}
```

Notes:
- Refund and consumed amount rules are validated in service layer.
- Facility ledger becomes inactive with endDate when cancellation succeeds.

## 3) Cancel And Assign Facility

Endpoint: PUT /api/studentFacility/cancel-assign/:rollNo

Purpose:
- Transfer from one facility configuration to another in one operation.

Required header:
- x-idempotency-key

Sample body:

```json
{
  "cancel": {
    "facilityType": "transport",
    "applyFromAcademicYear": "2025-2026",
    "endDate": "2025-09-30",
    "conceptionAmount": 3000,
    "refundMode": "wallet"
  },
  "assign": {
    "applyFromAcademicYear": "2025-2026",
    "effectiveDate": "2025-10-01",
    "hostel": {
      "isApplicable": true,
      "id": "67f5ea94ee7b84a3c89d1b4a"
    }
  }
}
```

Typical use:
- Transport to hostel
- Hostel to transport
- Hostel to different hostel
- Transport to different transport

## 4) Get Transfer By ID

Endpoint: GET /api/studentFacility/transfer/:transferId

Purpose:
- Fetch one facility transfer/cancel-and-assign record by transferId.

## Common Errors

- 400 for invalid request payload or invalid academic year format.
- 401 for missing or invalid token.
- 404 for student or master configuration not found.
- 409 when paid/partial constraints prevent requested update.