# API Contract

Base URL for versioned endpoints:
`/api/v1`

This document distinguishes routes registered by the current Express application from planned endpoints. Only routes listed under **Currently registered endpoints** are callable in the current backend. The other endpoint shapes are retained as planning notes and are not implemented routes.

## Currently registered endpoints

### `GET /`
Returns `{ success: true, message: "Asoudeh API is running" }`.

### `GET /api/v1/health`

Returns HTTP 200 with `{ success: true, data: { status: "ok", service: "asoudeh-backend", timestamp } }`.

### `POST /api/v1/auth/otp/request`
Request body: `{ "phone": "09121234567" }`. Persian/Arabic digits and common `+98`, `0098`, or `98` prefixes are normalized to `09xxxxxxxxx`.

The current code has no SMS provider. OTP delivery is unavailable unless both `NODE_ENV=development` and `OTP_DEV_SIMULATOR_ENABLED=true`; only then does the simulator return `developmentOtp` in the response. With the simulator disabled, requests return `503 OTP_DELIVERY_UNAVAILABLE` and never include a code. The generic response message does not disclose whether an account exists.

### `POST /api/v1/auth/otp/verify`
Request body: `{ "phone": "09121234567", "code": "012345" }`.

Success for an existing account: `{ success: true, data: { registrationRequired: false, csrfToken } }`, with access, refresh, and CSRF cookies set.

Success for a new account: `{ success: true, data: { registrationRequired: true, csrfToken } }`, with a short-lived registration cookie and CSRF cookie set.

### `POST /api/v1/auth/register/complete`
Requires the registration cookie and CSRF header. Request body: `{ "displayName": "نام نمایشی" }`.

Success: HTTP 201 with `{ success: true, data: { profile, csrfToken } }`, and session cookies set. A profile contains `id`, `displayName`, `phone`, `birthYear`, `initialBalance`, and `accessibilitySettings`.

### `POST /api/v1/auth/refresh`
Requires the refresh cookie and CSRF header. Success: `{ success: true, data: { refreshed: true, csrfToken } }`, with rotated access, refresh, and CSRF cookies.

### `POST /api/v1/auth/logout`
Requires the CSRF cookie/header pair. Success: `{ success: true, message }`; session-family revocation is attempted and auth cookies are cleared. Access tokens linked to a revoked or rotated session are rejected on subsequent protected requests.

### `GET /api/v1/auth/csrf`
Requires the configured Origin and returns `{ success: true, data: { csrfToken } }` while setting the matching CSRF cookie. The frontend keeps this token in memory only.

### `GET /api/v1/me`
Requires the access cookie. Success: `{ success: true, data: { profile } }`.

### `PATCH /api/v1/me/profile`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. At least one field is required:

```json
{
  "displayName": "نام نمایشی",
  "birthYear": 1350,
  "initialBalance": 250000,
  "accessibilitySettings": { "fontScale": 1.5, "highContrast": true }
}
```

`displayName` is trimmed and 1–80 characters; `birthYear` is optional/null or a Solar Hijri year from 1300 through the current year; `initialBalance` is an integer non-negative safe number in toman; `fontScale` is one of `1`, `1.25`, `1.5`, `2`; `highContrast` is boolean. Success: `{ success: true, data: { profile } }`.

All state-changing authentication and profile requests require the exact configured `CLIENT_URL` Origin. Cookie-authenticated requests also require the CSRF cookie echoed in `X-CSRF-Token`. Common failures include `400 VALIDATION_ERROR` or `OTP_INVALID`, `401 AUTHENTICATION_REQUIRED`/`SESSION_INVALID`/`SESSION_EXPIRED`/`REFRESH_TOKEN_REUSED`, `403 ORIGIN_REQUIRED`/`ORIGIN_NOT_ALLOWED`/`CSRF_VALIDATION_FAILED`, `409 ACCOUNT_ALREADY_EXISTS`, `429 OTP_RATE_LIMITED`/`OTP_TEMPORARILY_BLOCKED`, and `503 AUTH_NOT_CONFIGURED`/`OTP_DELIVERY_UNAVAILABLE`. Rate-limit responses include `Retry-After` when available. Errors use `{ success: false, error: { code, message, details? } }`.

Unknown routes return HTTP 404 with `{ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }`. Unexpected errors return HTTP 500 with a generic public message; implementation details are not included in the response.

## Planned endpoints — not registered

The following endpoint shapes are planned only. The current backend does not register these routes, so requests to them receive the standard 404 response.

### Transactions
- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `PATCH /api/v1/transactions/:id`
- `DELETE /api/v1/transactions/:id`

### Categories
- `GET /api/v1/categories`
- `POST /api/v1/categories`

### Budgets
- `GET /api/v1/budgets`
- `POST /api/v1/budgets`
- `PATCH /api/v1/budgets/:id`
- `DELETE /api/v1/budgets/:id`

### Reminders
- `GET /api/v1/reminders`
- `POST /api/v1/reminders`
- `PATCH /api/v1/reminders/:id`
- `DELETE /api/v1/reminders/:id`

### Reports
- `GET /api/v1/reports/summary`

### Caregiver
- `GET /api/v1/caregiver/links`
- `POST /api/v1/caregiver/links`
- `DELETE /api/v1/caregiver/links/:id`

Response convention:
`{ success, data, message, meta }`

Error convention:
`{ success: false, error: { code, message, details? } }`
