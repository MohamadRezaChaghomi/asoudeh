# Security and implementation decisions

## Authentication and profile checkpoint

Recorded: 2026-10-21

### OTP request throttling

- Allow at most 3 OTP requests per normalized mobile number in any rolling 15-minute window.
- Allow at most 10 OTP requests per client IP in any rolling 15-minute window.
- Count requests whether or not the phone number belongs to an existing user.
- Persist counters in MongoDB so limits are shared across backend processes. Store keyed hashes of phone numbers and IP addresses rather than raw rate-limit keys.
- Return the same generic success response for known and unknown numbers. A throttled request returns HTTP 429 with a generic Persian retry message and a `Retry-After` header.

### OTP resend, attempts, and expiry

The random-code requirement below applies to a future SMS delivery integration. The local development simulator intentionally uses the fixed fallback described here.
- The local development simulator uses `OTP_DEV_FALLBACK_CODE` (default `123456`), which must be exactly six digits. Development challenges cannot be verified outside development or while the simulator is disabled. This fixed code must not be used with shared or production data; any future SMS provider must use cryptographically generated codes.
- OTPs are cryptographically generated six-digit decimal codes, valid for 5 minutes, and stored only as an HMAC-SHA-256 digest using a dedicated server secret.
- Allow at most 5 failed verification attempts. The fifth failure blocks verification and further OTP sends for that phone number for 10 minutes.
- Enforce a server-side resend cooldown of 60 seconds by default (`OTP_RESEND_COOLDOWN_SECONDS`). The successful request response reports the delay so the client can display a countdown; early retries return HTTP 429 with `Retry-After`. The challenge update also checks the cooldown atomically to prevent concurrent resend requests from bypassing it.
- Requesting another code does not clear failed attempts or an active block. A replacement code may be issued only when the phone is not blocked and both request limits permit it; its challenge retains the existing attempt count until its attempt window ends.
- A replacement code invalidates the previous code. Expired challenges cannot be verified.
- Challenges and counters are persisted with expiry indexes; OTP values and request bodies are never logged.
- The simulator may include the OTP in a development-only response field only when `NODE_ENV=development` and `OTP_DEV_SIMULATOR_ENABLED=true`. Otherwise no simulator OTP is returned or logged. The simulator is disabled in every other environment.
- A local quick-login shortcut is restricted to `NODE_ENV=development`, explicit `OTP_DEV_QUICK_LOGIN_ENABLED=true`, the simulator, and one configured phone (`OTP_DEV_QUICK_LOGIN_PHONE`). The client submits the server-provided development code to the normal OTP verification endpoint; this does not bypass backend verification or create a session directly.
- `AUTH_HASH_SECRET` is a dedicated secret of at least 32 bytes used for OTP, refresh-token, and rate-limit HMACs. Authentication endpoints fail closed if it is absent or too short; it is never derived from the JWT signing key. CSRF tokens are random and compared with a constant-time comparison; they do not use this HMAC secret.

### CSRF and Origin validation

- Require the exact configured `CLIENT_URL` origin on all authentication and profile state-changing requests; reject missing, malformed, `null`, or non-matching Origin values.
- For cookie-authenticated state-changing requests, additionally require a random CSRF cookie and an identical `X-CSRF-Token` header. Compare the values without timing-dependent string comparison.
- Issue and rotate the CSRF token alongside successful authentication and refresh. Return it to frontend JavaScript in the authentication response or Origin-checked bootstrap response and keep it in memory; the matching cookie is scoped to the API path. Authentication cookies are `HttpOnly`.
- Apply the same Origin validation to OTP request and verification endpoints, even before the user is authenticated.

### Session and cookie policy

- Access JWT lifetime is 15 minutes. Refresh credentials are opaque, cryptographically random, valid for 30 days, stored only as keyed hashes, rotated on every successful refresh, and revocable by session family.
- Reuse of a rotated refresh credential revokes every session in that token family.
- Protected requests verify that the access token's session exists, is unexpired, unrotated, and not revoked. If session state cannot be read, the request fails closed.
- Use host-only cookies: `asoudeh_access` (`HttpOnly`, `Path=/api/v1`), `asoudeh_refresh` (`HttpOnly`, `Path=/api/v1/auth`), and `asoudeh_csrf` (not `HttpOnly`, `Path=/api/v1`). Do not set a `Domain` attribute.
- Local development uses `SameSite=Lax` and `Secure=false` for HTTP localhost. Production uses `SameSite=Lax` and `Secure=true`; production frontend and API must be same-site HTTPS origins. Cross-site deployment is not supported by this checkpoint.
- Clear cookies using the same path and attributes used to set them. Frontend JavaScript must never persist access or refresh credentials in browser storage.

### Profile validation

- Canonical phone numbers use Iranian mobile format `09` followed by 9 digits. Common `+98`, `0098`, and Persian/Arabic digit input is normalized before validation and storage.
- Display names are trimmed and limited to 1–80 characters. Birth year is optional and, when supplied, must be an Iranian Solar Hijri year from 1300 through the current Solar Hijri year.
- Initial balance is a non-negative safe integer in toman. Accessibility text scale is restricted to 100%, 125%, 150%, or 200%; high contrast is boolean.

### Account deletion

- Recorded: 2026-10-21. A 30-day delay between a valid OTP-confirmed deletion request and permanent data purge was selected.
- The request immediately blocks authenticated access and revokes all sessions. The OTP is single-use and must be issued to the phone number stored on the authenticated profile.
- A backend worker checks at startup and once per minute. Purge operations are idempotent, delete account-owned financial/reminder records and related caregiver/audit/OTP records first, and remove the user last; a failed collection delete is logged and retried on a later worker pass.
- The API currently provides no cancellation route. Production OTP delivery is still unavailable until an SMS provider is configured.

## Category management checkpoint

Recorded: 2026-10-21

- The category specification defines `userId: null` as a system category and uniqueness by `(userId, type, name)`. The API lists those system categories read-only alongside the authenticated user’s categories; create and update operations always scope ownership to the authenticated user.
- API-created categories use only the specified `income` and `expense` types. The legacy schema value `both` remains readable for existing documents but cannot be created through the API.
- Category names are trimmed and limited to 50 characters. The specification defines the icon field as a string but gives no allowed-value list; the API therefore accepts a non-empty string and uses the existing `wallet` default when omitted.
- Duplicate names are compared exactly after trimming and are scoped by type and owner as specified; case folding is not introduced because the specification does not define it.
- The model’s existing `isActive` field is used for deactivation/reactivation. `DELETE /api/v1/categories/:id` is registered but intentionally returns `409 CATEGORY_DELETION_UNAVAILABLE` for an owned category without changing data. The available MongoDB topology is standalone, so multi-document reassignment cannot be guaranteed atomically against concurrent transaction creation. Enabling deletion requires a transaction-capable replica set or an equivalent schema/workflow that safely blocks concurrent references, plus a confirmed type-correct income fallback; the specification names “متفرقه” but does not define the income fallback.
- The development-only seed inserts the specification’s eight expense defaults (including “متفرقه”) and three income defaults (including “سایر”) using `$setOnInsert`. It requires an explicit local `asoudeh_dev` URI and confirmation value, and never modifies personal categories or existing defaults.

## Transaction management checkpoint

- Transaction ownership is always derived from the authenticated server-side identity. List and mutation operations are scoped to that owner; deleted records are excluded from lists and cannot be updated or deleted again.
- Keep the existing transaction model and API field names `date` and `note` rather than renaming persisted fields to the specification’s `occurredOn` and `description`. Dates are exchanged as date-only `YYYY-MM-DD` values and stored at UTC midnight; future dates are rejected. Notes are limited to 200 characters.
- Transaction amounts are positive safe integers in toman, with an API maximum of 1,000,000,000,000 toman based on the specification’s example boundary. This preserves integer arithmetic for persisted amounts.
- A transaction category must be active, either personal to the authenticated user or system-owned (`userId: null`), and match the transaction type. The legacy category type `both` remains accepted for existing records.
- Deactivating a category prevents assigning it to a new transaction or switching another transaction to it. An existing transaction may still be edited while retaining its same, still-owned category; this does not reactivate the category.
- Deletion is soft deletion via `deletedAt`; this preserves transaction history and avoids physical data loss.
- The transaction list defaults to 20 items, newest first with `_id` as a deterministic tie-breaker, and returns total item/page counts. `pageSize` is capped at 100 and page is capped at 10,000 to bound offset scans.
- Undo is enforced server-side for ten seconds from the persisted `deletedAt`; the restore operation is owner-scoped and atomic for a single transaction. The frontend persists only pending transaction IDs and server-provided expiry timestamps in session storage; the server remains authoritative.
- The Persian transaction form follows the specified amount, category/date, and review sequence. Jalali selection and Gregorian date conversion use the platform `Intl` Persian calendar support without adding a date dependency. Date-only values are stored at UTC midnight; current-day validation follows `Asia/Tehran`.

## Financial dashboard checkpoint

- The monthly remaining amount follows the specification: initial balance + income in the current month − expenses in the current month. It is not described as a live bank balance.
- The specification defines monthly totals but not the calendar. The dashboard uses Solar Hijri month boundaries to match the Persian-facing product; the current civil day and upcoming-reminder window use `Asia/Tehran`.
- Dashboard totals are aggregated as MongoDB decimal values and returned as integer strings, avoiding JavaScript floating-point arithmetic in sum and remaining calculations. Individual stored transaction amounts retain the existing integer-number representation.
- The dashboard reads only the authenticated user’s initial balance, non-deleted transactions, and active near-term reminder records. It does not create reminders or imply that notification delivery is available.
- No threshold for labeling the remaining amount “good” or “needs attention” is specified, so the dashboard displays the calculated amount without inventing a status classification.

## Monthly budget checkpoint

- Budgets use the specification’s Solar Hijri `monthKey` (`MM-YYYY`) and a unique `(userId, categoryId, monthKey)` index. The corresponding Gregorian interval is start-inclusive and end-exclusive.
- A budget can be assigned only to an active personal expense category owned by the authenticated user. If a category becomes inactive later, its existing budget remains visible and its amount can still be edited without reassigning it.
- Spending is calculated from non-deleted expense transactions matching the authenticated owner, category, and month. Decimal database aggregation and integer-string API totals avoid floating-point summation.
- `warning` begins at 80% and `exceeded` at 100%; percentages are rounded to one decimal place for display. Remaining amount may be negative when spending exceeds the limit.
- Budget creation enforces one budget per user/category/month in both service behavior and the database unique index. Deletion removes only the budget record and does not modify transactions or categories.
- The earlier scaffold schema stored `period`, `startDate`, and `endDate`; this implementation replaces those unused fields with `monthKey`. No live database was inspected or migrated. Before deploying against any database that may contain scaffold-era budget documents, verify that they are disposable or perform a reviewed migration to `monthKey`; do not assume existing records are compatible.

## Reminder management checkpoint

- Reminder management follows FR-13: title, due date, optional amount, no-repeat/monthly recurrence, upcoming display within seven days, and completion. No SMS, email, push delivery, or background scheduling is implied.
- Completion history is stored separately from reminders with `reminderId`, authenticated `userId`, the existing `MM-YYYY` Jalali month key, and server-generated `completedAt`. The unique `(reminderId, monthKey)` index makes completion idempotent and prevents concurrent duplicates. The server determines the month using the `Asia/Tehran` calendar date; clients cannot choose the completion period.
- Completing a monthly reminder applies only to that Jalali month. It becomes actionable in the next month, while previous month completion records remain unchanged. Completing a `none` reminder stores history and deactivates it permanently.
- Monthly occurrences are recalculated from the original due date’s Jalali day. If the target month lacks that day, use that month’s final day without changing the original anchor.
- Reminder deletion is soft archival (`deletedAt`, `isActive: false`); edits and archival never remove completion history. Amounts, when present, are positive safe integer toman values.
- The pre-existing schema allowed `yearly`, but FR-13 permits only `none` and `monthly`. Existing yearly values are retained and remain readable; new and updated recurrence values accept only specified types. Completion for legacy yearly records fails explicitly with `409 LEGACY_REMINDER_RECURRENCE_UNSUPPORTED`. No database was inspected or migrated.
- Deploy the `ReminderCompletion` unique index before serving completion requests. The code declares the index and isolated tests initialize/verify it; production index creation must follow the operator’s safe index-deployment process. No production index or data migration was run.

## Monthly reports and caregiver access

- Monthly reports use the existing `MM-YYYY` Solar Hijri key and transaction date boundaries. They show exact integer-string income/expense sums, count, expense totals by category, and expense comparison with the previous Jalali month. Percentage change is `null` when the previous month has no expenses rather than presenting an undefined or infinite percentage.
- Caregiver roles are relationship-based; a user can simultaneously own an account and act as a caregiver. The model keeps the existing boolean permission representation for compatibility, while the API exposes the specification’s explicit `VIEW_SUMMARY`, `VIEW_TRANSACTIONS`, and `VIEW_REPORTS` permissions. New invitations require an explicit, non-empty permission set.
- An invitation is bound to a normalized Iranian mobile number and only that account can accept/reject it. The account phone is taken from the authenticated user record, not from the request. Caregiver requests check an active relationship and the exact permission on every read; writes are not exposed. Revocation changes link status so subsequent reads fail.
- Legacy active links without a stored invited phone and accepted response timestamp fail closed and cannot authorize reads; this avoids granting access based on the scaffold’s default permissions.
- Invitation, decision, revocation, and caregiver data-view actions are written to `AuditLog` without recording sensitive transaction content or phone numbers.
- The unique partial `active_caregiver_phone_unique` index prevents multiple pending/active invitations for one senior and phone. Isolated tests verify it. Before production index rollout, check for duplicate existing records and build it using the deployment’s reviewed index process; no production database/index was accessed or changed.
- SMS delivery for caregiver invitations is not integrated. The UI explains that invitation notification must currently happen out of band; no delivery is claimed.

## Report category privacy

- Report and transaction category labels are loaded only for the authenticated owner or system categories. If legacy/corrupt records reference another user’s category, the financial transaction remains in the owner-scoped total but the private category label is replaced with a generic unavailable-category label.

## Accessibility preference application

- Font scale and high-contrast preferences are loaded from the authenticated profile for dashboard routes and applied across navigation and full reloads. Settings applies changes immediately; leaving the authenticated route group resets document-level styles so a later public/login page does not inherit the prior account’s presentation.
- High-contrast mode uses a yellow keyboard-focus outline and brighter income/expense text. A WCAG/Lighthouse score and assistive-technology usability evaluation have not yet been measured.

## PWA and offline transaction drafts

- The web app manifest provides install metadata and a same-origin SVG icon. The service worker is registered only in production and caches only the generic offline page and icon; it does not cache navigations, authenticated pages, API responses, or financial data.
- Offline navigation falls back to a static Persian page that contains no account information. It links back to the application so an explicitly saved transaction draft can be restored after connectivity returns.
- Draft persistence is off by default and requires an explicit checkbox. When enabled, the draft is stored in `sessionStorage` under the authenticated profile ID, not in a shared key or persistent local storage. It is available only in that browser tab/session and matching account, and is removed when the user opts out or a transaction is saved. Drafts are not submitted automatically.
- A saved draft can remain in the browser session after logout, but another account cannot load it because the key is scoped to the server-provided profile ID. Closing the tab/session clears it. No authenticated offline access or background synchronization is provided.
- The old `/transactions/new` placeholder redirects to the implemented `/transactions` workflow so existing links do not land on an unfinished page.
