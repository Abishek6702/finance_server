# Hostel Fee Structure API

Base path: /api/hostel

## Access Control

- GET /api/hostel -> protect + admin
- POST/PUT/DELETE routes -> protect + superadmin

## Endpoints

1. GET /api/hostel
2. POST /api/hostel
3. POST /api/hostel/bulk
4. PUT /api/hostel/:id/fee
5. PUT /api/hostel/:id
6. DELETE /api/hostel/:id

## Request Validation Rules

Shared hostel fields:
- block: one of A, B, C, D, E, F
- sharing: one of 2, 3, 4, 5
- isAttached: boolean
- fee: number, >= 0

ID params:
- id must be a valid 24-char MongoDB ObjectId.

## Endpoint Details

### GET /api/hostel

Returns all hostel configurations, including:
- info.blocks
- info.sharing
- info.isAttached
- detailed[] list with id, block, sharing, isAttached, fee

### POST /api/hostel

Creates a single hostel configuration.

Sample body:

```json
{
	"block": "A",
	"sharing": 3,
	"isAttached": true,
	"fee": 30000
}
```

### POST /api/hostel/bulk

Creates multiple hostel configurations.

Sample body:

```json
[
	{ "block": "A", "sharing": 2, "isAttached": true, "fee": 42000 },
	{ "block": "A", "sharing": 3, "isAttached": true, "fee": 36000 }
]
```

### PUT /api/hostel/:id/fee

Updates only fee for a configuration.

Sample body:

```json
{
	"fee": 35000
}
```

### PUT /api/hostel/:id

Updates full hostel configuration (block, sharing, isAttached, fee).

### DELETE /api/hostel/:id

Deletes one hostel configuration.

## Common Error Codes

- 400 invalid payload or invalid ObjectId
- 401 missing/invalid token
- 403 authenticated but not allowed for route
- 404 hostel configuration not found
- 409 duplicate block+sharing+isAttached combination
 