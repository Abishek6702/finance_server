# Student Facility Management API

Handles assignment and transfer of hostel and transport facilities for students. Updates both the `Student` document and all matching `StudentFeeTracking` year records from `applyFromAcademicYear` through the end of the student's batch.

**Collections touched:** `students` (read/write), `hostels` (read), `transports` (read), `studentfeetrackings` (read/write)

---

## PUT /api/studentFacility/:rollNo

Assigns, transfers, or removes hostel and/or transport facility for a student.

**Auth:** `protect` + `admin` (admin and superadmin roles)

### URL Parameters

| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| `rollNo`  | String | Yes      | Student roll number   |

### Request Body

```json
{
  "transport": {
    "isApplicable": true,
    "route": "Bharathiyar University",
    "stopName": "Bharathiyar University"
  },
  "hostel": {
    "isApplicable": true,
    "block": "B",
    "sharing": 4,
    "isAttached": false
  },
  "applyFromAcademicYear": "2025-2026"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `applyFromAcademicYear` | String | Yes | `YYYY-YYYY` format; must be ≥ student's `currentAcademicYear`; must fall within the student's batch range |
| `transport` | Object | At least one of transport/hostel | — |
| `transport.isApplicable` | Boolean | Yes (if transport present) | — |
| `transport.route` | String | Yes (if `isApplicable: true`) | Must match a route in Transport master |
| `transport.stopName` | String | Yes (if `isApplicable: true`) | Must match a stop on the given route |
| `hostel` | Object | At least one of transport/hostel | — |
| `hostel.isApplicable` | Boolean | Yes (if hostel present) | — |
| `hostel.block` | String | Yes (if `isApplicable: true`) | A–F |
| `hostel.sharing` | Number | Yes (if `isApplicable: true`) | 2, 3, 4, or 5 |
| `hostel.isAttached` | Boolean | Yes (if `isApplicable: true`) | attached bathroom flag |

### Behaviour

- **applyFromAcademicYear** determines the starting year for fee tracking updates. All `academicYearWiseRecord` entries from this year through the student's batch end year are updated. If any of those future years don't yet exist in the tracking record, they are silently skipped.
- **Student document** is always updated when the operation succeeds.
- **Fee recalculation** — the `StudentFeeTracking` pre-save hook automatically recalculates NET totals (`total.total = subTotal − concession`) and year-level aggregates after each update. Existing `paid` amounts are preserved.
- **Setting `isApplicable: false`** clears the facility from both the student document and all target year records in fee tracking.
- **Omitting a facility key** (e.g., omitting `hostel`) means that facility is not touched.

### Edge Case — Paid/Partial Guard

If the fee for the facility being changed already has a `Paid` or `Partial` status in the `applyFromAcademicYear` tracking record, the request is rejected with `409`. The guard only applies to `applyFromAcademicYear`; future years are always overwritten.

### Success Response

```json
{
  "success": true,
  "data": {
    "student": { ... }
  },
  "message": "Facility updated successfully"
}
```

If no fee tracking year records were found for the target range:
```json
{
  "message": "Student profile updated; no matching fee tracking records found for the target year range"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `applyFromAcademicYear` missing or wrong format |
| 400 | Neither `transport` nor `hostel` provided |
| 400 | `transport.isApplicable: true` but missing `route` or `stopName` |
| 400 | `hostel.isApplicable: true` but missing `block`, `sharing`, or `isAttached` |
| 400 | `applyFromAcademicYear` is before student's `currentAcademicYear` |
| 400 | `applyFromAcademicYear` is outside the student's batch range |
| 401 | No auth token or invalid token |
| 404 | Student not found |
| 404 | Transport route/stop not found in master |
| 404 | Hostel block/sharing/attached config not found in master |
| 409 | Transport fee already Paid or Partial in `applyFromAcademicYear` |
| 409 | Hostel fee already Paid or Partial in `applyFromAcademicYear` |

### Supported Transitions

| From | To | Notes |
|------|----|-|
| Transport | Hostel | Both keys in body; transport `isApplicable: false`, hostel `isApplicable: true` |
| Hostel | Transport | Both keys in body |
| Transport | Different Transport | Only transport key; provide new route/stopName |
| Hostel | Different Hostel | Only hostel key; provide new block/sharing/isAttached |
| Transport/Hostel | None | Set `isApplicable: false` |
| None | Transport or Hostel | Set `isApplicable: true` with lookup fields | 