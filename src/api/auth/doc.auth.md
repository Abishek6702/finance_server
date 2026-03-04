# Auth Module — API Documentation

## 1. Module Overview

The **Auth** module handles user authentication using JSON Web Tokens (JWT). Tokens are returned in the response body and must be sent by the client as an `Authorization: Bearer <token>` header on subsequent requests. All other modules depend on this module's middleware (`protect`, `admin`, `superadmin`) to guard their endpoints.

**Dependencies / Coupling**
- `ActivityLog` model — login success and failure events are audited.
- `generateToken` utility — JWT creation on successful login.
- All other modules depend on `authMiddleware` guards produced by this module.

**Database Collections**

| Collection | Model | Purpose |
|---|---|---|
| `users` | `User` | Stores user credentials and role |
| `activitylogs` | `ActivityLog` | Audit trail for login events |

---

## 2. API Documentation

---

### POST `/api/auth/login`

**Auth required:** No

**Description:** Authenticates a user with email and password. Returns a JWT token in the response body.

#### Request

##### Body Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Registered user email address |
| `password` | `string` | Yes | Plain-text password |

##### Example Request Body
```json
{
  "email": "admin@sece.ac.in",
  "password": "Admin@123"
}
```

#### Validation

| Rule | Error |
|---|---|
| `email` is missing | 400 — `Email and password are required` |
| `password` is missing | 400 — `Email and password are required` |
| User not found | 404 — `User not found` |
| Password does not match | 401 — `Invalid password` |

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Admin User",
    "email": "admin@sece.ac.in",
    "role": "admin",
    "firstTimeLogin": false,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NWYxYT..."
  },
  "message": "Login successful"
}
```

**400 — Missing credentials**
```json
{
  "success": false,
  "data": null,
  "message": "Email and password are required"
}
```

**401 — Wrong password**
```json
{
  "success": false,
  "data": null,
  "message": "Invalid password"
}
```

**404 — User not found**
```json
{
  "success": false,
  "data": null,
  "message": "User not found"
}
```

**500 — Internal server error**
```json
{
  "success": false,
  "data": null,
  "message": "Internal server error"
}
```

---

### POST `/api/auth/logout`

**Auth required:** Yes — any authenticated role (`user`, `admin`, `superadmin`)

**Description:** Logs out the authenticated user server-side.

#### Request

No request body. Provide the JWT via `Authorization: Bearer <token>` header.

#### Response

**200 — Success**
```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

**401 — Not authenticated**
```json
{
  "success": false,
  "data": null,
  "message": "Not authorized, no token"
}
```

**500 — Internal server error**
```json
{
  "success": false,
  "data": null,
  "message": "Internal server error"
}
```

---

## 3. Edge Cases

- **Failed-login auditing:** Every failed login attempt is recorded individually in `ActivityLog` with `status: "FAILED"` for a complete audit trail.
- **Token storage:** The JWT is returned in `data.token`. Clients are responsible for storing it (e.g., memory or `localStorage`) and sending it as `Authorization: Bearer <token>` on every subsequent request.
- **Token invalidation:** Server-side token revocation is not implemented; add revoked-token storage if required.
- **Role elevation:** Roles are assigned at seeding time. There is no public endpoint to create users — only seeded accounts exist (`admin@sece.ac.in`, `superadmin@sece.ac.in`).
- **All subsequent API calls** must include the JWT obtained from this endpoint via the `Authorization: Bearer <token>` header.

---

## 4. User Schema Reference

| Field | Type | Constraints |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique |
| `password` | String | Required, stored as bcrypt hash |
| `role` | String | Enum: `admin`, `superadmin`, `user` — default `user` |
