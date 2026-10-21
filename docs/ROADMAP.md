# Roadmap

## Phase 0
Repository, environment, GitHub, MongoDB, frontend/backend bootstrap. **Status:** bootstrap is present.

## Phase 1
Express + Mongoose + configuration + error handling + validation. **Status:** configuration, liveness and MongoDB readiness endpoints, error handling, authentication/profile, category, transaction, budget, reminder, report, and caregiver APIs are implemented with request validation. Production deployment and operational verification remain.

## Phase 2
Authentication and user profile. **Status:** OTP-based registration/login flow, cookie sessions, refresh/logout, and profile editing are implemented in the current code. OTP-confirmed account deletion immediately revokes access and schedules idempotent data purge after 30 days. OTP delivery uses a development-only simulator; no real SMS provider is connected, so production OTP delivery is unavailable.

## Phase 3
Category management, transaction core, and dashboard. **Status:** authenticated personal category listing, creation, editing, and activation controls are implemented; the development-only system-category seed is idempotent and limited to the local `asoudeh_dev` database. The category DELETE API explicitly returns `409 CATEGORY_DELETION_UNAVAILABLE` without changing data. Enabling reassignment requires transaction-capable MongoDB (or an equivalent safe schema/workflow) and a confirmed type-correct income fallback. The authenticated transaction API and Persian/RTL page support ownership-checked listing, creation, editing, soft deletion, 20-item pagination, server-enforced ten-second undo, a three-step form, and Jalali date selection. The authenticated dashboard shows current Solar Hijri month totals, the specified remaining calculation, five recent transactions, and stored reminders due within seven days.

## Phase 4
Budget and reminder. **Status:** monthly personal expense budgets are implemented with authenticated CRUD, Solar Hijri month selection, unique user/category/month assignments, exact spending totals, 80%/100% status thresholds, and a Persian/RTL page. Reminder management is implemented with authenticated CRUD/archive and idempotent month-scoped completion history, Jalali monthly recurrence, short-month clamping, dashboard integration, and a Persian/RTL management page. No external notification delivery is implemented.

## Phase 5
Reports and caregiver read-only. **Status:** monthly report API and Persian/RTL page are implemented with owner-scoped totals, category expense shares, and comparison to the previous Jalali month. Caregiver invitation, explicit acceptance/rejection, permission-checked summary/transaction/report reads, audit events, and immediate revocation are implemented. SMS invitation delivery is unavailable; notification must happen out of band. Production index rollout and usability testing remain.

## Phase 6
Accessibility, PWA and offline draft. **Status:** profile-level font-size and high-contrast settings are reapplied across dashboard navigation and reloads; high-contrast mode has a distinct keyboard-focus indicator. The frontend exposes a web app manifest, registers a production-only service worker that caches only a generic offline page and icon (never authenticated pages or API responses), and provides an offline navigation fallback. Production-browser checks cover manifest/icon loading, service-worker registration, cache contents, offline fallback and reconnection. The transaction form offers explicit, opt-in, account-keyed session-only draft storage, with restore and account-isolation E2E coverage. The `/transactions/new` route redirects to the implemented transaction workflow. Actual installation prompt, WCAG 2.2 AA/Lighthouse scoring and broader usability evaluation remain unverified.

## Phase 7
Unit/API/E2E tests and usability testing. **Status:** API tests cover authentication, categories, transactions, pagination, undo, seed idempotency, dashboard calculations, monthly budgets, reminders, reports, and caregiver permissions; Jalali conversion/recurrence tests and authentication, transaction, budget, reminder, report, and caregiver browser tests exist. Broader feature coverage and real user usability testing remain unfinished.

## Phase 8
Deployment, seed data, documentation and demo. **Status:** a guarded local development system-category seed command is available; deployment and demo work remain unfinished.
