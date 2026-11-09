# Database model and ownership notes

## Persistence

The backend uses MongoDB through Mongoose. Model schemas and indexes are declared in `backend/src/models/`; application connections are established in `backend/src/config/db.ts`. Mongoose `ref` values describe application-level references; they are not MongoDB-enforced foreign keys.

## Models

| Model | Main data | Relationships and notes |
|---|---|---|
| `User` | Display name, optional phone/email, birth year, initial balance, role, accessibility preferences, deletion scheduling fields | Account root. Phone and email have sparse unique indexes. |
| `AuthSession` | User, token hash, family ID, absolute/idle expiry, rotation/revocation state | Belongs to a user. Stores a hash rather than a refresh credential; TTL index is on absolute expiry. |
| `OtpChallenge` | Phone and phone hash, OTP hash, delivery mode, expiry, attempt/block and send-lock state | One challenge per phone hash; OTP is not stored in plaintext. Expiry cleanup uses a TTL index. |
| `OtpRateLimit` | Hashed scope key, request timestamps, expiry | TTL-cleaned phone/IP request-limit records; raw phone/IP values are not used as keys. |
| `Category` | Optional owner, name, income/expense type, icon, active state | `userId: null` denotes a system category. Unique `(userId, type, name)` index. |
| `Transaction` | Owner, type, integer amount, category, date, optional note, soft-delete timestamp | Owner/deletion/date, category/date, amount-sort, and aggregation indexes support real list and monthly sum queries. |
| `Budget` | Owner, category, Solar Hijri month key, limit amount | Unique `(userId, categoryId, monthKey)` and `(userId, monthKey)` lookup indexes. |
| `Reminder` | Owner, title, date, recurrence, optional amount, active/deletion state | Owner/deletion/date list and owner/active/deletion/date upcoming-reminder indexes. |
| `ReminderCompletion` | Owner, reminder, month key, completion time | Unique `(reminderId, monthKey)` index makes monthly completion idempotent; owner/month and owner/reminder/time indexes support reads. |
| `CaregiverLink` | Senior, optional caregiver account/phone, state, read permissions, response/revocation times | Partial uniqueness prevents duplicate pending/active links for the same senior/phone. |
| `AuditLog` | Actor, target user, caregiver action, event time | Indexed by actor/target and target/time for access-event queries. |
| `AssistantRateLimit` | Hashed-user/time-window key, request count, expiry | TTL-cleaned per-user assistant rate-limit record; no question or conversation is stored. |

Inspect the model files for field-level types, defaults, and complete index definitions. This table is an orientation, not a schema migration specification.

## Ownership and cross-user access

- Personal records carry a `userId` and are queried/mutated using the authenticated identity, not an owner ID supplied by the request.
- Personal categories can be referenced only by their owner; system categories are shared read-only.
- Transactions, budgets, reminders, reports, and dashboard aggregates are scoped to the current user.
- Caregiver reads require an accepted, active link and the matching permission. A caregiver link does not allow mutation of the senior's financial data.
- Account deletion purges related records before deleting the user. The operation is idempotent and retried by the worker after a failure, but it does not use a cross-collection database transaction.

## Amounts and dates

- Money is denominated in toman. Transaction and budget inputs use integer values; totals that need exact arithmetic are serialized as integer strings.
- Transaction/reminder APIs accept date-only `YYYY-MM-DD` strings. Monthly budgets/reports use a Solar Hijri `MM-YYYY` key.
- Reminder completion is stored per Solar Hijri month. Monthly recurrence preserves the intended Jalali day and clamps short months.

## Indexes and operational cautions

Models declare unique, lookup, and TTL indexes, including unique phone/email, owner/category/month budget, reminder/month completion, OTP phone hash, session token hash, and expiration cleanup indexes. Production Mongoose automatic index creation is disabled.

Run `npm --prefix backend run db:ensure-indexes` to detect and report duplicates before creating any declared unique indexes; it refuses non-test databases unless `--confirm-non-test-db` is supplied. Run `npm --prefix backend run db:report-orphans` for a read-only reference-integrity report. Neither script is called by server startup. Verify index rollout on a non-production copy and maintain backups.

## Category deletion options

- **Archive-only:** preserve historical references; safest and simplest, but archived categories remain stored.
- **Reassign:** transactionally move references to an active, type-compatible fallback (income to income, expense to expense) before deletion; requires safe budget and uniqueness-conflict handling.

Category deletion remains disabled until a concurrency-safe option is agreed; the current standalone local MongoDB topology does not provide multi-document transaction guarantees. Legacy records with `Reminder.recurrence=yearly` or `Category.type=both` remain readable; current model and API validation reject those values on new writes.

## Test databases

Development uses the local `asoudeh` database from `backend/.env.example`. Database/API tests must use the separate local `asoudeh_test` database with no credentials. Test cleanup is scoped to the fixtures created by those tests; do not point test commands at a shared or production URI. See [ENVIRONMENT.md](./ENVIRONMENT.md).
