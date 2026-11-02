# Roadmap

## Phase 0
Repository, environment, GitHub, MongoDB, frontend/backend bootstrap. **Status:** bootstrap is present.

## Phase 1
Express + Mongoose + configuration + error handling + validation. **Status:** configuration, liveness and MongoDB readiness endpoints, error handling, authentication/profile, category, transaction, budget, reminder, report, and caregiver APIs are implemented with request validation. Production deployment and operational verification remain.

## Phase 2
Authentication and user profile. **Status:** OTP-based registration/login flow, a dedicated `/verify-otp` route, cookie sessions, refresh/logout, profile editing, and a server-enforced configurable resend cooldown are implemented in the current code. OTP-confirmed account deletion immediately revokes access and schedules idempotent data purge after 30 days. A server-side SMS.ir Verify adapter and a separate development-only simulator are implemented; the checked-in sample leaves the API key empty, and live credentials, an approved template, and delivery have not been verified.

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

## Current next phases (2026-11-02)

Priorities below are ordered by release risk rather than feature novelty. Do not treat a phase as complete until its exit checks pass in a non-production environment.

### Phase 1 — Dependency and release stabilization

- **Work:** keep production dependency advisories at zero; track the remaining moderate development-tooling advisories without forcing incompatible ESLint changes. Verify environment templates, provider-off defaults, and backend/frontend build reproducibility.
- **Exit criteria:** both production dependency audits report zero; lint, typecheck, unit/API tests, E2E tests, and builds pass from a clean dependency install; no real SMS is sent by standard tests.
- **Dependencies:** none.

### Phase 2 — Staging operational safety

- **Work:** configure same-site HTTPS origins and `NODE_ENV=production`; verify secure cookies, secrets management, database indexes, backups/restore, health/readiness, deletion-worker monitoring, and rollback procedures.
- **Exit criteria:** staging smoke test passes, a restore drill is recorded, required indexes are verified, worker failures alert, and a deployment rollback is demonstrated.
- **Dependencies:** operator-approved hosting and database topology; no production credentials in Git.

### Phase 3 — OTP delivery readiness

- **Work:** obtain SMS.ir credentials and approved Verify template; keep simulator off in production; run an explicitly authorized Sandbox check with a controlled number.
- **Exit criteria:** provider accepts a request with documented `status === 1`; failures remain sanitized and do not retry on uncertain timeout; a separate delivery report confirms whether a handset message was received.
- **Dependencies:** SMS.ir account, approved template, and explicit test authorization. Sandbox acceptance alone is not delivery proof.

### Phase 4 — Data integrity and feature gaps

- **Work:** decide whether category deletion is needed and define a type-correct fallback plus a concurrency-safe reassignment workflow; add frontend category behavior tests; improve boundary coverage for Jalali months and financial aggregations.
- **Exit criteria:** category operations have owner-isolation and concurrency tests; unresolved delete behavior remains clearly disabled until then; representative edge fixtures pass.
- **Dependencies:** product decision and transaction-capable MongoDB or equivalent safe design.

### Phase 5 — Accessibility and product validation

- **Work:** keyboard, screen-reader, 200% zoom, contrast, touch-target, real-device and representative-user evaluation; improve the guide assistant only from observed needs and after provider privacy review.
- **Exit criteria:** findings are recorded with reproducible results; agreed accessibility criteria have measured evidence; assistant remains unavailable unless configured and approved.
- **Dependencies:** representative users, target devices, approved AI-provider retention/privacy terms.

### Deferred scope

Offline transaction synchronization, notifications, OCR, voice input, exports, and multi-account features are not required release gates. Define user value, privacy, safety, and acceptance criteria before implementation.
