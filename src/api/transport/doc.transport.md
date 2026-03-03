# Transport Module — API Documentation

## 1. Module Overview

The **Transport** module manages the route-bus-stop-fee mapping for the institution's college bus service. It is seeded with 9 routes and approximately 78 stop records on startup. Fee updates propagate to matching `StudentFeeTracking` records.

**Dependencies / Coupling**
- **Students module** — transport fee for a newly enrolled student is resolved from this collection.
- **Student Fee Tracking module** — when a transport fee is updated (`PUT /:id`), all matching tracking records are updated automatically.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `transports` | `Transport` | Route / bus number / stop / fee mapping (compound unique: route + busNo + stop) |

---

## 2. API Documentation

---

### GET `/api/transport`

**Auth required:** Yes — Admin (`admin` or `superadmin`)

**Description:** Returns the complete transport configuration grouped by route and bus number.

#### Request

No parameters.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "Route 1": {
      "TN-01-AB-1234": [
        { "_id": "665f1a2b3c4d5e6f7a8b9c60", "route": "Route 1", "busNo": "TN-01-AB-1234", "stop": "Erode",     "fee": 12000 },
        { "_id": "665f1a2b3c4d5e6f7a8b9c61", "route": "Route 1", "busNo": "TN-01-AB-1234", "stop": "Gobichettipalayam", "fee": 10000 }
      ]
    },
    "Route 2": { "..." : "..." }
  },
  "message": "Transport mapping fetched successfully"
}
```

---

### POST `/api/transport/stops`

**Auth required:** Yes — Superadmin

**Description:** Returns all stops, optionally filtered by route and/or bus number.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `route` | string | No | Route name (e.g. `Route 1`) |
| `busNo` | string | No | Bus registration number |

##### Example Request Body
```json
{
  "route": "Route 1",
  "busNo": "TN-01-AB-1234"
}
```

#### Validation

| Rule | Error |
|---|---|
| `route` is not a string | 400 |
| `route` is empty after trimming | 400 |
| `busNo` is not a string | 400 |
| `busNo` is empty after trimming | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": ["Erode", "Gobichettipalayam", "Bhavani"],
  "message": "Stops fetched successfully"
}
```

---

### POST `/api/transport/buses`

**Auth required:** Yes — Superadmin

**Description:** Returns all buses that serve a specific stop.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `stop` | string | Yes | Stop name |

##### Example Request Body
```json
{
  "stop": "Erode"
}
```

#### Validation

| Rule | Error |
|---|---|
| `stop` missing | 400 — `stop is required` |
| `stop` is not a string | 400 |
| `stop` is empty after trimming | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    { "route": "Route 1", "busNo": "TN-01-AB-1234" },
    { "route": "Route 3", "busNo": "TN-33-CD-5678" }
  ],
  "message": "Buses fetched successfully"
}
```

---

### POST `/api/transport/fees`

**Auth required:** Yes — Superadmin

**Description:** Returns fee records filtered by bus number and/or stop. At least one of `busNo` or `stop` must be provided.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `busNo` | string | Conditional | Bus number |
| `stop` | string | Conditional | Stop name |

> At least one of `busNo` or `stop` is required.

##### Example Request Body
```json
{
  "busNo": "TN-01-AB-1234",
  "stop": "Erode"
}
```

#### Validation

| Rule | Error |
|---|---|
| Neither `busNo` nor `stop` provided | 400 — `At least one of busNo or stop is required` |
| `busNo` or `stop` is not a string | 400 |
| `busNo` or `stop` is empty after trimming | 400 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": [
    { "_id": "665f1a2b3c4d5e6f7a8b9c60", "route": "Route 1", "busNo": "TN-01-AB-1234", "stop": "Erode", "fee": 12000 }
  ],
  "message": "Fees fetched successfully"
}
```

---

### POST `/api/transport/add`

**Auth required:** Yes — Superadmin

**Description:** Creates a new transport fee record. The combination of `route` + `busNo` + `stop` must be unique.

#### Request

##### Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| `route` | string | Yes | Non-empty string; trimmed before storage |
| `busNo` | string | Yes | Non-empty string; trimmed before storage |
| `stop` | string | Yes | Non-empty string; trimmed before storage |
| `fee` | number | Yes | Non-negative finite number |

##### Example Request Body
```json
{
  "route": "Route 10",
  "busNo": "TN-45-EF-9012",
  "stop": "Namakkal",
  "fee": 14000
}
```

#### Validation

| Rule | Error |
|---|---|
| `route`, `busNo`, or `stop` missing or empty | 400 |
| `fee` missing, negative, or non-finite | 400 |
| Duplicate `route` + `busNo` + `stop` | 400 |

#### Response

**201 — Created**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c70",
    "route": "Route 10",
    "busNo": "TN-45-EF-9012",
    "stop": "Namakkal",
    "fee": 14000
  },
  "message": "Transport record added successfully"
}
```

**400 — Duplicate**
```json
{
  "success": false,
  "data": null,
  "message": "Transport record already exists for this route, bus, and stop combination"
}
```

---

### POST `/api/transport/bulk`

**Auth required:** Yes — Superadmin

**Description:** Creates multiple transport fee records in one request. Returns `201` if all succeed, `207 Multi-Status` if any fail.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `records` | array | Yes | Non-empty array of transport objects (same schema as `POST /add`) |

##### Example Request Body
```json
{
  "records": [
    { "route": "Route 11", "busNo": "TN-11-GH-3456", "stop": "Salem",     "fee": 15000 },
    { "route": "Route 11", "busNo": "TN-11-GH-3456", "stop": "Attur",     "fee": 13000 },
    { "route": "Route 11", "busNo": "TN-11-GH-3456", "stop": "Rasipuram", "fee": 11000 }
  ]
}
```

#### Response

**201 — All created**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 3, "created": 3, "failed": 0 },
    "created": [
      { "route": "Route 11", "busNo": "TN-11-GH-3456", "stop": "Salem", "fee": 15000 }
    ],
    "failed": []
  },
  "message": "All transport records created successfully"
}
```

**207 — Partial success**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 3, "created": 2, "failed": 1 },
    "created": [ "..." ],
    "failed": [
      { "index": 2, "error": "Duplicate key: route+busNo+stop already exists" }
    ]
  },
  "message": "2 created, 1 failed"
}
```

---

### PUT `/api/transport/:id`

**Auth required:** Yes — Superadmin

**Description:** Updates a transport record by MongoDB `_id`. If the `fee` field is changed, the new fee is propagated to all matching `StudentFeeTracking` records.

#### Request

##### Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the transport record |

##### Body Schema

At least one field is required.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `fee` | number | No | Non-negative finite number |
| `route` | string | No | Non-empty string |
| `busNo` | string | No | Non-empty string |
| `stop` | string | No | Non-empty string |

##### Example Request Body
```json
{
  "fee": 13500
}
```

#### Validation

| Rule | Error |
|---|---|
| No fields provided | 400 — `At least one field (fee, route, busNo, stop) is required for update` |
| `fee` is negative or non-finite | 400 |
| `route`, `busNo`, or `stop` is empty after trimming | 400 |
| `id` does not match any record | 404 |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "transport": {
      "_id": "665f1a2b3c4d5e6f7a8b9c60",
      "route": "Route 1",
      "busNo": "TN-01-AB-1234",
      "stop": "Erode",
      "fee": 13500
    },
    "trackingRecordsUpdated": 12
  },
  "message": "Transport record updated successfully"
}
```

**404 — Not found**
```json
{
  "success": false,
  "data": null,
  "message": "Transport record not found"
}
```

---

## 3. Edge Cases

- **Compound unique constraint:** Each `(route, busNo, stop)` combination is unique. Attempting a duplicate insertion returns a MongoDB duplicate-key error.
- **Fee propagation on update:** When `fee` is changed via `PUT /:id`, the service locates all `StudentFeeTracking` records where the transport configuration matches (`route`, `busNo`, `stop`) and updates their transport fee demand. Already-paid amounts are preserved.
- **Bulk partial failure:** Failed rows in `POST /bulk` do not roll back successful rows; each record is upserted independently.
- **String normalisation:** `route`, `busNo`, and `stop` are trimmed of leading/trailing whitespace before storage and comparison. `block` normalisation (uppercase) does not apply here.
- **Seeded data:** Approximately 78 stop records across 9 routes are seeded on startup if the collection is empty. New routes or stops can be added via `POST /add` or `POST /bulk` without affecting existing seed data.
- **Stop lookup direction:** `POST /stops` filters stops given a bus, while `POST /buses` finds buses given a stop — supporting both student-facing lookup directions.
