# Hostel Module — API Documentation

## 1. Module Overview

The **Hostel** module manages the block-to-room-type-to-fee mapping used by the institution's hostels. It is seeded with 48 configurations on startup (blocks A–F × sharing types × attached/non-attached). Fee updates propagate to existing `StudentFeeTracking` records.

**Dependencies / Coupling**
- **Students module** — hostel fee for a newly enrolled student is resolved from this collection.
- **Student Fee Tracking module** — when a hostel fee is updated (`PUT /:id`), all matching tracking records are updated automatically.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `hostels` | `Hostel` | Block / room-type / fee mapping (compound unique: block + sharing + isAttached) |

---

## 2. API Documentation

---

### GET `/api/hostel`

**Auth required:** Yes — Admin (`admin` or `superadmin`)

**Description:** Returns the complete hostel configuration grouped by block.

#### Request

No parameters.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "A": [
      { "_id": "665f1a2b3c4d5e6f7a8b9c40", "block": "A", "sharing": 2, "isAttached": true,  "fee": 70000 },
      { "_id": "665f1a2b3c4d5e6f7a8b9c41", "block": "A", "sharing": 2, "isAttached": false, "fee": 60000 },
      { "_id": "665f1a2b3c4d5e6f7a8b9c42", "block": "A", "sharing": 3, "isAttached": true,  "fee": 55000 }
    ],
    "B": [ "..." ]
  },
  "message": "Hostel mapping fetched successfully"
}
```

---

### POST `/api/hostel/blocks`

**Auth required:** Yes — Superadmin

**Description:** Returns all available blocks, optionally filtered by sharing count and/or attached bathroom availability.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `sharing` | number | No | `2`, `3`, `4`, or `5` |
| `isAttached` | boolean | No | `true` or `false` |

##### Example Request Body
```json
{
  "sharing": 2,
  "isAttached": true
}
```

#### Validation

| Rule | Error |
|---|---|
| `sharing` is not `2`, `3`, `4`, or `5` | 400 |
| `isAttached` is not a boolean | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": ["A", "B", "C"],
  "message": "Blocks fetched successfully"
}
```

---

### POST `/api/hostel/roomTypes`

**Auth required:** Yes — Superadmin

**Description:** Returns the room type configurations available in a specific block.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `block` | string | No | Block name (e.g. `A`) — case-insensitive |

##### Example Request Body
```json
{
  "block": "A"
}
```

#### Validation

| Rule | Error |
|---|---|
| `block` is not a string | 400 |
| `block` is empty after trimming | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    { "sharing": 2, "isAttached": true  },
    { "sharing": 2, "isAttached": false },
    { "sharing": 3, "isAttached": true  }
  ],
  "message": "Room types fetched successfully"
}
```

---

### POST `/api/hostel/fees`

**Auth required:** Yes — Superadmin

**Description:** Returns fee records filtered by any combination of block, sharing, and isAttached. At least one filter must be provided.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `block` | string | Conditional | Required unless `sharing` or `isAttached` is provided |
| `sharing` | number | Conditional | `2`, `3`, `4`, or `5` |
| `isAttached` | boolean | Conditional | `true` or `false` |

> At least one of `block`, `sharing`, or `isAttached` must be present.

##### Example Request Body
```json
{
  "block": "A",
  "sharing": 2,
  "isAttached": true
}
```

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    { "_id": "665f1a2b3c4d5e6f7a8b9c40", "block": "A", "sharing": 2, "isAttached": true, "fee": 70000 }
  ],
  "message": "Fees fetched successfully"
}
```

**400 — No filter provided**
```json
{
  "success": false,
  "data": null,
  "message": "At least one of block, sharing, or isAttached is required"
}
```

---

### POST `/api/hostel/add`

**Auth required:** Yes — Superadmin

**Description:** Creates a new hostel fee record. The combination of `block` + `sharing` + `isAttached` must be unique.

#### Request

##### Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| `block` | string | Yes | Non-empty; stored as uppercase |
| `sharing` | number | Yes | `2`, `3`, `4`, or `5` |
| `isAttached` | boolean | Yes | — |
| `fee` | number | Yes | Non-negative finite number |

##### Example Request Body
```json
{
  "block": "G",
  "sharing": 3,
  "isAttached": false,
  "fee": 50000
}
```

#### Validation

| Rule | Error |
|---|---|
| `block` missing or empty | 400 |
| `sharing` not in `[2,3,4,5]` | 400 |
| `isAttached` not a boolean | 400 |
| `fee` missing or negative | 400 |
| Duplicate `block` + `sharing` + `isAttached` | 400 |

#### Response

**201 — Created**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c50",
    "block": "G",
    "sharing": 3,
    "isAttached": false,
    "fee": 50000
  },
  "message": "Hostel record added successfully"
}
```

---

### POST `/api/hostel/bulk`

**Auth required:** Yes — Superadmin

**Description:** Creates multiple hostel fee records in one request. Returns `201` if all succeed, `207 Multi-Status` if any fail.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `records` | array | Yes | Non-empty array of hostel objects (same schema as `POST /add`) |

##### Example Request Body
```json
{
  "records": [
    { "block": "H", "sharing": 2, "isAttached": true,  "fee": 72000 },
    { "block": "H", "sharing": 2, "isAttached": false, "fee": 62000 }
  ]
}
```

#### Response

**201 — All created**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 2, "created": 2, "failed": 0 },
    "created": [ { "block": "H", "sharing": 2, "isAttached": true, "fee": 72000 } ],
    "failed": []
  },
  "message": "All hostel records created successfully"
}
```

**207 — Partial success**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 2, "created": 1, "failed": 1 },
    "created": [ { "block": "H", "sharing": 2, "isAttached": true, "fee": 72000 } ],
    "failed": [ { "index": 1, "error": "Duplicate key: block+sharing+isAttached already exists" } ]
  },
  "message": "1 created, 1 failed"
}
```

---

### PUT `/api/hostel/:id`

**Auth required:** Yes — Superadmin

**Description:** Updates a hostel record by MongoDB `_id`. If the `fee` field is changed, the new fee is propagated to all matching `StudentFeeTracking` records.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the hostel record |

##### Body Schema

At least one field is required.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `fee` | number | No | Non-negative finite number |
| `block` | string | No | Non-empty string |
| `sharing` | number | No | `2`, `3`, `4`, or `5` |
| `isAttached` | boolean | No | — |

##### Example Request Body
```json
{
  "fee": 75000
}
```

#### Validation

| Rule | Error |
|---|---|
| No fields provided | 400 — `At least one field (fee, block, sharing, isAttached) is required for update` |
| `fee` is negative or non-finite | 400 |
| `sharing` not in `[2,3,4,5]` | 400 |
| `isAttached` not a boolean | 400 |
| `id` does not match any record | 404 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "hostel": { "_id": "665f1a2b3c4d5e6f7a8b9c40", "block": "A", "sharing": 2, "isAttached": true, "fee": 75000 },
    "trackingRecordsUpdated": 18
  },
  "message": "Hostel record updated successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Hostel record not found"
}
```

---

## 3. Edge Cases

- **Compound unique constraint:** Each `(block, sharing, isAttached)` combination is unique. Duplicate insertion returns a MongoDB duplicate-key error.
- **Fee propagation on update:** When `fee` is updated via `PUT /:id`, the service finds all `StudentFeeTracking` records where the hostel configuration matches and updates their hostel fee demand accordingly. Already-paid amounts are preserved.
- **Bulk partial failure:** Failed rows in `POST /bulk` do not roll back successful rows; each record is inserted independently.
- **Block name normalisation:** All `block` values are trimmed and uppercased before storage (e.g. `" a "` → `"A"`).
- **Seeded data:** 48 records covering blocks A–F, sharing 2–5, attached/non-attached are seeded on server startup if the collection is empty. You can add new blocks (G, H, etc.) without modifying seed logic.
