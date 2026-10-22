# API Contract

Base URL for versioned endpoints:
`/api/v1`

This document distinguishes routes registered by the current Express application from planned endpoints. Only routes listed under **Currently registered endpoints** are callable in the current backend. The other endpoint shapes are retained as planning notes and are not implemented routes.

## Currently registered endpoints

### `GET /`
Returns `{ success: true, message: "Asoudeh API is running" }`.

### `GET /api/v1/health`

Returns HTTP 200 with `{ success: true, data: { status: "ok", service: "asoudeh-backend", timestamp } }`.
This is a liveness check and does not depend on MongoDB.

### `GET /api/v1/health/ready`

Returns HTTP 200 with `{ success: true, data: { status: "ready", service: "asoudeh-backend", timestamp } }` when the MongoDB connection is established. Otherwise it returns HTTP 503 with `{ success: false, error: { code: "SERVICE_NOT_READY", message: "Service is not ready." } }`. Use this endpoint for deployment readiness checks; it does not expose database details.

### `POST /api/v1/auth/otp/request`
Request body: `{ "phone": "09121234567" }`. Persian/Arabic digits and common `+98`, `0098`, or `98` prefixes are normalized to `09xxxxxxxxx`.

SMS.ir Verify delivery is available only when `SMSIR_MODE=production` is explicitly selected and the required server-side settings are valid. The adapter sends to the official Verify endpoint and requires the provider response to contain `status: 1` and a positive message ID; this confirms API acceptance, not handset delivery. `SMSIR_MODE=sandbox` makes no external request because the current official OpenAPI document does not document sandbox behavior.

For local development, OTP delivery is available through the simulator only when both `NODE_ENV=development` and `OTP_DEV_SIMULATOR_ENABLED=true`; only then does the simulator return `developmentOtp` in the response. With `OTP_DEV_QUICK_LOGIN_ENABLED=true`, a request for `OTP_DEV_QUICK_LOGIN_PHONE` (default `09120000000`) additionally returns `developmentQuickLogin: true`. This is only a client convenience: it submits the returned development code to the normal verification endpoint, which still consumes the challenge and issues the session. With both delivery modes unavailable, requests return `503 OTP_DELIVERY_UNAVAILABLE` and never include a code. The generic response message does not disclose whether an account exists.

Successful requests include `resendAfterSeconds` (default 60, configured by `OTP_RESEND_COOLDOWN_SECONDS`). A resend attempted during this interval returns `429 OTP_RATE_LIMITED` with a `Retry-After` header. Phone and IP rolling-window request limits also apply.

### `POST /api/v1/auth/otp/verify`
Request body: `{ "phone": "09121234567", "code": "012345" }`.

When the local development simulator is enabled, the requested code is `OTP_DEV_FALLBACK_CODE` (default `123456`), shown by the verification page for regular numbers. For the configured quick-login phone, the client submits this same code automatically; it remains single-use, expires after five minutes, and is subject to existing request and attempt limits. Development-issued codes cannot be verified outside development or after disabling the simulator. Do not use this fixed code with shared or production data. This simulator is the local no-SMS path, not an automatic fallback after a real SMS provider failure.

See [SMS.ir setup and verification details](./SMSIR_SETUP.md) for provider configuration, account prerequisites, testing, and the authorized live-test procedure.

Success for an existing account: `{ success: true, data: { registrationRequired: false, csrfToken } }`, with access, refresh, and CSRF cookies set.

Success for a new account: `{ success: true, data: { registrationRequired: true, csrfToken } }`, with a short-lived registration cookie and CSRF cookie set.

### `POST /api/v1/auth/register/complete`
Requires the registration cookie and CSRF header. Request body: `{ "displayName": "نام نمایشی" }`.

Success: HTTP 201 with `{ success: true, data: { profile, csrfToken } }`, and session cookies set. A profile contains `id`, `displayName`, `phone`, `birthYear`, `initialBalance`, and `accessibilitySettings`.

### `POST /api/v1/auth/refresh`
Requires the refresh cookie and CSRF header. Success: `{ success: true, data: { refreshed: true, csrfToken } }`, with rotated access, refresh, and CSRF cookies. Refresh-token rotation preserves the session's original 30-day absolute expiry and does not extend its ten-minute inactivity deadline.

### `POST /api/v1/auth/activity`
Requires an authenticated access cookie, the configured Origin, and the CSRF cookie/header pair. The frontend calls this endpoint only after trusted user interaction; background data reads and refresh requests do not extend the session. Success: `{ success: true, data: { active: true } }` and the server moves the session's inactivity deadline to ten minutes from the accepted activity. If either the absolute or inactivity deadline has passed, the server rejects the request and revokes the session family.

### `POST /api/v1/auth/logout`
Requires the CSRF cookie/header pair. Success: `{ success: true, message }`; session-family revocation is attempted and auth cookies are cleared. Access tokens linked to a revoked or rotated session are rejected on subsequent protected requests.

### `POST /api/v1/auth/account-deletion`
Requires the access cookie, configured Origin, CSRF cookie/header pair, and `{ "code": "012345" }`. First request a code using `POST /api/v1/auth/otp/request` for the authenticated profile’s phone. A valid, unused OTP schedules permanent deletion exactly 30 days later, immediately revokes all account sessions, blocks further authenticated access (including caregiver reads), and clears the browser’s authentication cookies. Login with a pending-deletion phone returns `409 ACCOUNT_DELETION_PENDING`.

The backend worker checks due accounts at startup and every 60 seconds. It removes the user’s sessions, categories, transactions, budgets, reminders and completion history, caregiver links, audit events, and phone-bound OTP data before deleting the user record. Purging is idempotent and retries on a later check after a failure. The current API does not provide cancellation. Verify the `deletionScheduledAt` index is safely deployed before production use. OTP delivery uses the local development simulator or the explicitly configured SMS.ir Verify adapter; production requests fail closed when SMS.ir mode or account settings are unavailable.

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

All state-changing authentication and profile requests require the exact configured `CLIENT_URL` Origin. Cookie-authenticated requests also require the CSRF cookie echoed in `X-CSRF-Token`. Common failures include `400 VALIDATION_ERROR` or `OTP_INVALID`, `401 AUTHENTICATION_REQUIRED`/`SESSION_INVALID`/`SESSION_EXPIRED`/`REFRESH_TOKEN_REUSED`, `403 ORIGIN_REQUIRED`/`ORIGIN_NOT_ALLOWED`/`CSRF_VALIDATION_FAILED`, `409 ACCOUNT_ALREADY_EXISTS`/`ACCOUNT_DELETION_PENDING`, `429 OTP_RATE_LIMITED`/`OTP_TEMPORARILY_BLOCKED`, and `503 AUTH_NOT_CONFIGURED`/`OTP_DELIVERY_UNAVAILABLE`. Rate-limit responses include `Retry-After` when available. Errors use `{ success: false, error: { code, message, details? } }`.

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
Requires the access cookie. Lists only the authenticated user’s non-deleted transactions, newest date first, 20 items per page by default. Optional query parameters are `type` (`income` or `expense`), `categoryId`, `from`, `to`, `search` (up to 100 trimmed characters), `sortBy` (`date` or `amount`, default `date`), `sortOrder` (`asc` or `desc`, default `desc`), `page` (default `1`, maximum `10,000`), and `pageSize` (default `20`, maximum `100`). Date filters use `YYYY-MM-DD`, and both range boundaries are inclusive. Search matches note text or category names belonging to the user or system; input is treated literally, not as a regular expression. Equal sort values are ordered by descending transaction ID for stable pagination. Each transaction contains `id`, `type`, `amount`, `categoryId`, `categoryName`, `categoryIcon`, `date`, and `note`. Category display data is resolved only from the owner’s categories or system categories; an invalid legacy reference is shown as `دسته‌بندی ناموجود`. The response includes `{ data: { transactions, pagination: { page, pageSize, totalItems, totalPages } } }`; an empty list has `totalPages: 0`.

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

### `GET /api/v1/budgets?month=MM-YYYY`
Requires the access cookie. `month` is a Solar Hijri month key such as `07-1405`. Returns only the authenticated user’s budgets for that month, together with the corresponding Gregorian date boundaries and calculated spending. Spending includes only that user’s non-deleted expense transactions in the budget category and month. Amount totals are integer strings; `percentageUsed` is rounded to one decimal place. A budget is `normal` below 80%, `warning` from 80% to less than 100%, and `exceeded` at or above 100%. Empty months return an empty `budgets` array.

### `POST /api/v1/budgets`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Request body: `{ "categoryId": "...", "monthKey": "07-1405", "limitAmount": 250000 }`. `limitAmount` must be a positive integer in toman not greater than 1,000,000,000,000. The category must be an active personal expense category owned by the authenticated user; system, income, inactive, missing, and other users’ categories are rejected. Only one budget per user/category/month is allowed; a duplicate returns `409 BUDGET_ALREADY_EXISTS`. Success: HTTP 201 with `{ success: true, data: { budget } }`.

### `PATCH /api/v1/budgets/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Accepts a non-empty subset of `categoryId` and `limitAmount`; any new category assignment must meet the same eligibility rules as creation. An existing budget may retain its now-inactive category while its amount is edited. Budgets and category assignments are owner-scoped. A duplicate category/month assignment returns `409 BUDGET_ALREADY_EXISTS`; an inaccessible budget returns `404 BUDGET_NOT_FOUND`. Success: `{ success: true, data: { budget } }`.

### `DELETE /api/v1/budgets/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Physically deletes only a budget owned by the authenticated user. An inaccessible or already deleted budget returns `404 BUDGET_NOT_FOUND`. Success: `{ success: true, message: "بودجه حذف شد." }`.

### `GET /api/v1/reminders`
Requires the access cookie. Returns the authenticated user’s non-deleted reminders and the current Solar Hijri `monthKey` (`MM-YYYY`, for example `07-1405`). Reminder fields include `id`, `title`, the original `date` (`YYYY-MM-DD`), `nextDueDate`, `recurrence`, optional `amount` in toman, `isActive`, and `isCompleted`. A monthly reminder’s completion state applies only to the returned current month; a non-recurring reminder remains completed after it is deactivated. Existing legacy `yearly` records remain readable but cannot be newly created.

### `POST /api/v1/reminders`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Request body: `{ "title": "قبض برق", "date": "2026-10-25", "amount": 850000, "recurrence": "monthly" }`. `title` is trimmed and must contain 1–120 characters; `date` must be a valid Gregorian date-only value in `YYYY-MM-DD`; `amount` is optional and, when present, a positive safe integer in toman no greater than 1,000,000,000,000; `recurrence` must be `none` or `monthly`. Success: HTTP 201 with `{ success: true, data: { reminder } }`. Ownership is derived from the authenticated identity.

### `PATCH /api/v1/reminders/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Accepts a non-empty subset of `title`, `date`, `amount`, and `recurrence`, subject to creation validation. Set `amount` to `null` to clear it. Other users’ reminders, archived reminders, and invalid IDs return `404 REMINDER_NOT_FOUND` or `400 VALIDATION_ERROR`. A legacy `yearly` reminder is preserved as-is unless the owner explicitly changes it to `none` or `monthly`. Success: `{ success: true, data: { reminder } }`.

### `POST /api/v1/reminders/:id/complete`
Requires the access cookie, configured Origin, and CSRF cookie/header pair; send an empty JSON object. The server determines the current Jalali month in `Asia/Tehran`; clients cannot supply an owner or completion month. Success: `{ success: true, data: { completion: { id, reminderId, monthKey, completedAt } } }`. Repeating a monthly completion in the same month returns its existing record. A unique `(reminderId, monthKey)` index prevents duplicate history records under concurrent requests. A monthly reminder is actionable again next Jalali month without deleting the previous month’s history. Completing a `none` reminder archives it after recording completion; retries in later months return the original completion and keep it inactive. Legacy `yearly` reminders return `409 LEGACY_REMINDER_RECURRENCE_UNSUPPORTED` and are not modified.

### `DELETE /api/v1/reminders/:id`
Requires the access cookie, configured Origin, and CSRF cookie/header pair. Archives only a reminder owned by the authenticated user by setting its deletion time and inactive state; completion history is retained. Success: `{ success: true, message: "یادآور بایگانی شد." }`.

Monthly recurrence preserves the Jalali day of the original `date`. If a target month is shorter, its last day is used for that month only; later months are recalculated from the original date. The dashboard lists only active, not-yet-completed occurrences due from today through seven days ahead (inclusive), using the same occurrence and completion rules.

### `GET /api/v1/dashboard`
Requires the access cookie. Returns only data belonging to the authenticated user:

- `period`: the current Solar Hijri year/month and its Gregorian `startDate` and exclusive `endDateExclusive` date boundaries. The current day and reminder window use the `Asia/Tehran` time zone.
- `balance`: `initialBalance` as a number and `income`, `expenses`, and `remaining` as integer strings to preserve exact arithmetic. `remaining` is calculated as the profile’s initial balance plus current Solar Hijri month income minus current Solar Hijri month expenses.
- `recentTransactions`: up to five non-deleted transactions, newest first, with category display data.
- `upcomingReminders`: up to five active, not-yet-completed reminders with due dates from today through seven days ahead, inclusive. Monthly occurrences use Jalali dates, retain the original intended day when clamping short months, and are hidden for a month once completed.

Monthly sums omit soft-deleted transactions and use exact decimal aggregation. Empty results are returned as zero totals and empty arrays. The dashboard displays stored reminder records only; reminder creation/editing are provided by the separate reminder API. No scheduled notification delivery is implemented.

### `GET /api/v1/reports/monthly?month=MM-YYYY`
Requires the access cookie. The required `month` is a validated Solar Hijri month key. The response contains current-month income, expenses, transaction count, expense totals grouped by category with percentage shares, and a comparison with the previous Jalali month’s expenses. Aggregations include only the authenticated owner’s non-deleted transactions. Amount totals are integer strings; percentage change is `null` when the previous month had no expense total. Success: `{ success: true, data: { report } }`.

Category names are resolved only for categories owned by the report owner or system categories. Totals referencing unavailable legacy categories remain included in the expense total but are grouped under the generic `دسته‌بندی ناموجود` entry without exposing another user’s category metadata.

### Caregiver access
All routes below require the access cookie. State-changing requests also require the configured Origin and CSRF cookie/header pair.

- `GET /api/v1/caregiver/links` lists invitations/access links created by the current user.
- `POST /api/v1/caregiver/links` accepts `{ "phone": "09xxxxxxxxx", "permissions": ["VIEW_SUMMARY", "VIEW_TRANSACTIONS", "VIEW_REPORTS"] }`. Choose one or more explicit permissions. The invitation stays pending until an account registered to the invited phone accepts it. An active or pending duplicate returns `409 CAREGIVER_LINK_EXISTS`.
- `DELETE /api/v1/caregiver/links/:id` revokes an owned invitation or active link. Read access is denied on the next request after revocation; repeating a revoke for the same owned link is idempotent.
- `GET /api/v1/caregiver/invitations` lists pending invitations addressed to the authenticated account’s verified phone. `PATCH /api/v1/caregiver/invitations/:id` accepts `{ "decision": "accept" }` or `{ "decision": "reject" }`; only the matching phone can respond.
- `GET /api/v1/caregiver/seniors` lists active read-only access links accepted by the current user.
- `GET /api/v1/caregiver/seniors/:seniorId/summary` requires `VIEW_SUMMARY` and returns current-month financial totals only, without transaction details.
- `GET /api/v1/caregiver/seniors/:seniorId/transactions` requires `VIEW_TRANSACTIONS` and accepts the transaction list query filters.
- `GET /api/v1/caregiver/seniors/:seniorId/reports/monthly?month=MM-YYYY` requires `VIEW_REPORTS`.

Permission failures return `403 CAREGIVER_PERMISSION_REQUIRED`; absent, unaccepted, revoked, or cross-user links return `404` without exposing the senior’s data. Caregiver access never grants write operations. Legacy links without a verified phone-bound acceptance are not treated as authorization. Invitation, response, revocation, and data-view events are recorded in `auditLogs`. The application has no SMS provider: it records invitations but does not notify the invited phone, so the user must communicate the invitation through another channel. The `active_caregiver_phone_unique` database index prevents duplicate active/pending invitations; verify existing records and deploy this index safely before production use.

Unknown routes return HTTP 404 with `{ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }`. Unexpected errors return HTTP 500 with a generic public message; implementation details are not included in the response.

## Planned endpoints — not registered

The following endpoint shapes are planned only. The current backend does not register these routes, so requests to them receive the standard 404 response.

### Categories
- No additional category routes are planned here; `DELETE /api/v1/categories/:id` is registered but intentionally returns `409 CATEGORY_DELETION_UNAVAILABLE` as described above.

Response convention:
`{ success, data, message, meta }`

Error convention:
`{ success: false, error: { code, message, details? } }`
