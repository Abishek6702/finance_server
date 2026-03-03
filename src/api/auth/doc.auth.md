# Auth Module — API Documentation

## 1. Module Overview

The **Auth** module handles user authentication using JSON Web Tokens (JWT). It supports both cookie-based and Bearer-header token delivery. All other modules depend on this module's middleware (`protect`, `admin`, `superadmin`) to guard their endpoints.

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

**Description:** Authenticates a user with email and password. Returns a JWT token set as an `httpOnly` cookie and in the response body.

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

**Description:** Logs out the authenticated user by clearing the `token` cookie server-side.

#### Request

No request body. Provide the JWT via cookie or `Authorization: Bearer <token>` header.

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
- **Cookie configuration:** The JWT cookie is `httpOnly`, `SameSite: strict`, and expires in 30 days. Clients using REST (e.g., Postman) may read `data.token` from the response body directly.
- **Token invalidation:** Logout only clears the client-side cookie. Server-side token revocation is not implemented; add revoked-token storage if required.
- **Role elevation:** Roles are assigned at seeding time. There is no public endpoint to create users — only seeded accounts exist (`admin@sece.ac.in`, `superadmin@sece.ac.in`).
- **All subsequent API calls** must include the JWT obtained from this endpoint, either as the `token` cookie or the `Authorization` header.

---

## 4. User Schema Reference

| Field | Type | Constraints |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique |
| `password` | String | Required, stored as bcrypt hash |
| `role` | String | Enum: `admin`, `superadmin`, `user` — default `user` |
