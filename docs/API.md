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

### `GET /api/v1/categories`
Requires the access cookie. Returns the authenticated user’s personal categories and system categories (`userId: null`) as `{ success: true, data: { categories } }`. Each item contains `id`, `name`, `type`, `icon`, `isActive`, and `isDefault`. No system categories are seeded by this API.

For development only, `npm --prefix backend run seed:system-categories` seeds the eleven specification-defined system categories. The script requires `NODE_ENV=development`, a credential-free local `SEED_MONGODB_URI` for the dedicated `asoudeh_dev` database, and `SEED_CONFIRMATION=seed-default-categories`. It inserts only missing `(userId, type, name)` entries and does not modify personal or existing system categories.

PowerShell example (uses only the local development database):

```powershell
$env:NODE_ENV = 'development'
$env:SEED_MONGODB_URI = 'mongodb://127.0.0.1:27017/asoudeh_dev'
$env:SEED_CONFIRMATION = 'seed-default-categories'
npm --prefix backend run seed:system-categories
```

### `POST /api/v1/categories`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Request body: `{ "name": "خوراک", "type": "expense" }`; `icon` is optional and defaults to `wallet`. If supplied, `icon` must be a non-empty string; no icon-value list is defined. `name` is trimmed and limited to 1–50 characters; `type` is `income` or `expense`. The owner is always taken from the authenticated session. A duplicate `(userId, type, name)` returns `409 CATEGORY_ALREADY_EXISTS`. Success: HTTP 201 with `{ success: true, data: { category } }`.

### `PATCH /api/v1/categories/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. A personal category may be updated with one or more of `name`, `icon`, or `isActive`; system categories and other users’ categories cannot be changed. Empty updates and invalid IDs return `400 VALIDATION_ERROR`; an inaccessible category returns `404 CATEGORY_NOT_FOUND`. This endpoint deactivates/reactivates a category rather than deleting it. Physical deletion with transaction reassignment is not registered: the available isolated MongoDB server is standalone, so a concurrent-safe multi-document reassignment cannot be guaranteed without transaction-capable topology. The income fallback is also not specified as clearly as the expense “متفرقه” fallback.

### `DELETE /api/v1/categories/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. The endpoint is intentionally disabled: for an existing category owned by the authenticated user it returns `409 CATEGORY_DELETION_UNAVAILABLE` and leaves the category and its transactions unchanged. A category belonging to another user or a missing category returns `404 CATEGORY_NOT_FOUND`. Safe deletion requires a transaction-capable MongoDB replica set (or an equivalent schema/workflow that prevents concurrent references) and a confirmed type-correct fallback for income transactions; the current specification names “متفرقه” for reassignment but does not define an income fallback.

### `GET /api/v1/transactions`
Requires the access cookie. Lists only the authenticated user’s non-deleted transactions, newest date first, 20 items per page by default. Optional query parameters are `type` (`income` or `expense`), `categoryId`, `from`, `to`, `page` (default `1`, maximum `10,000`), and `pageSize` (default `20`, maximum `100`). Date filters use `YYYY-MM-DD`, and both range boundaries are inclusive. Each transaction contains `id`, `type`, `amount`, `categoryId`, `categoryName`, `categoryIcon`, `date`, and `note`. The response includes `{ data: { transactions, pagination: { page, pageSize, totalItems, totalPages } } }`; an empty list has `totalPages: 0`.

### `POST /api/v1/transactions`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Request body:

```json
{
  "type": "expense",
  "amount": 250000,
  "categoryId": "64b000000000000000000001",
  "date": "2020-01-15",
  "note": "خرید روزانه"
}
```

`type` must be `income` or `expense`; `amount` must be a positive integer in toman no greater than 1,000,000,000,000; `date` must be a valid non-future `YYYY-MM-DD` date; and `note` is optional and limited to 200 characters. The category must be active, belong to the authenticated user or be a system category, and have a matching type (legacy `both` categories are accepted). The owner is derived from the authenticated session. Success: HTTP 201 with `{ success: true, data: { transaction } }`.

### `PATCH /api/v1/transactions/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Accepts a non-empty subset of the creation fields. The transaction must belong to the authenticated user and must not already be soft-deleted; the same category and field validation applies. An invalid identifier returns `400 VALIDATION_ERROR`; a missing, deleted, or other user’s transaction returns `404 TRANSACTION_NOT_FOUND`. Success: `{ success: true, data: { transaction } }`.

### `DELETE /api/v1/transactions/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Soft-deletes only a non-deleted transaction owned by the authenticated user; deleted transactions are excluded from normal lists. An invalid identifier returns `400 VALIDATION_ERROR`; a missing, deleted, or other user’s transaction returns `404 TRANSACTION_NOT_FOUND`. Success includes `{ data: { deletedAt, undoExpiresAt } }`; the server allows restoration for ten seconds from `deletedAt`.

### `POST /api/v1/transactions/:id/restore`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Restores only the authenticated user’s transaction and only while its server-recorded soft-delete time is within the ten-second undo window. Success: `{ success: true, data: { transaction } }`. An expired undo returns `410 TRANSACTION_UNDO_EXPIRED`; a missing, already-restored, or other user’s transaction returns `404 TRANSACTION_NOT_FOUND`.

### `GET /api/v1/dashboard`
Requires the access cookie. Returns only data belonging to the authenticated user:

- `period`: the current Solar Hijri year/month and its Gregorian `startDate` and exclusive `endDateExclusive` date boundaries. The current day and reminder window use the `Asia/Tehran` time zone.
- `balance`: `initialBalance` as a number and `income`, `expenses`, and `remaining` as integer strings to preserve exact arithmetic. `remaining` is calculated as the profile’s initial balance plus current Solar Hijri month income minus current Solar Hijri month expenses.
- `recentTransactions`: up to five non-deleted transactions, newest first, with category display data.
- `upcomingReminders`: up to five active reminders with due dates from today through seven days ahead, inclusive.

Monthly sums omit soft-deleted transactions and use exact decimal aggregation. Empty results are returned as zero totals and empty arrays. This endpoint displays stored reminder records only; reminder creation, editing, scheduling, and notification delivery are not implemented.

Unknown routes return HTTP 404 with `{ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }`. Unexpected errors return HTTP 500 with a generic public message; implementation details are not included in the response.

## Planned endpoints — not registered

The following endpoint shapes are planned only. The current backend does not register these routes, so requests to them receive the standard 404 response.

### Categories
- No additional category routes are planned here; `DELETE /api/v1/categories/:id` is registered but intentionally returns `409 CATEGORY_DELETION_UNAVAILABLE` as described above.

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
