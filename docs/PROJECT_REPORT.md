# Asoudeh — Project Engineering Report

## Executive summary

Asoudeh is a Persian, right-to-left personal finance application aimed at older adults and users who benefit from a simpler interface. The repository contains a Next.js frontend and an Express/MongoDB API. The principal product workflows are implemented: passwordless OTP authentication, profile and category management, transaction tracking, dashboard totals, budgets, reminders, monthly reports, and permission-scoped read-only caregiver access.

The implementation is suitable for continued development and local verification, but **is not ready for production operation**. An SMS.ir Verify adapter exists, but account credentials and an approved template are not configured, so live OTP delivery has not been verified. Production deployment, database index rollout, accessibility certification, and real-user usability evaluation are also unverified.

This report records the current implementation and evidence without treating roadmap notes or specification goals as delivered or measured results.

## Project purpose and scope

The product is intended to help people manage personal income, expenses, monthly budgets, and reminders through an accessible Persian/RTL experience. A user may grant a caregiver specifically selected read-only permissions. The caregiver must accept an invitation addressed to their verified phone; permissions can be revoked and access events are audited.

The repository includes the original requirements in [SPECIFICATION.pdf](./SPECIFICATION.pdf), as well as implementation decisions and operational notes. The specification's UX targets—including completing common tasks in roughly 30 seconds, approximately 90% task success, and an accessibility score target around 95—are **goals, not measured outcomes**. No user study or WCAG/Lighthouse certification is claimed.

## Architecture and technology

| Layer | Implementation |
| --- | --- |
| Web client | Next.js App Router, React, TypeScript, Tailwind CSS; Persian and RTL |
| API | Node.js, Express, TypeScript, Zod request validation |
| Persistence | MongoDB through Mongoose models and indexes |
| Authentication | OTP/passwordless flow, cookie-backed sessions, CSRF token and Origin validation |
| Tests | Vitest and Supertest for backend, Node test runner for Jalali utilities, Playwright for browser flows |

The backend separates routes, controllers, services, models, and validators. Feature route/service/model files are located in [backend/src/routes](../backend/src/routes), [backend/src/services](../backend/src/services), and [backend/src/models](../backend/src/models). The frontend pages and components are under [frontend/app](../frontend/app), with API clients and shared utilities under `frontend/lib`.

```mermaid
flowchart LR
    Browser[Next.js Persian / RTL client] -->|HTTP, cookies, Origin and CSRF| API[Express API]
    API --> Validation[Zod validation]
    API --> Services[Feature services]
    Services --> Models[Mongoose models]
    Models --> Mongo[(MongoDB)]
    API --> Auth[Session, OTP and access controls]
```

Important feature areas include:

- **Authentication and profile:** [auth routes](../backend/src/routes/auth.routes.ts), [auth service](../backend/src/services/auth.service.ts), user and session models, OTP challenges, and account-deletion processing.
- **Financial core:** categories, transactions, dashboard, budgets, reminders, and reports each have their own API/service areas.
- **Caregiver access:** explicit invitation/acceptance, permission checks, revocation, and audit records; no caregiver write operations are provided.
- **Dates and money:** Solar Hijri month handling is used for financial periods and reminder recurrence. Financial aggregates that require exact arithmetic are returned as integer strings.
- **Offline behavior:** the service worker caches only the generic public offline page and its icon. It does not cache authenticated pages or API responses.

See the [API contract](./API.md) for registered routes and response behavior. That document distinguishes live routes from planning notes.

## Implemented scope and gap inventory

Status meanings:

- **IMPLEMENTED** — the feature is present in the application/API and has relevant code or test coverage.
- **PARTIALLY IMPLEMENTED** — a meaningful subset is delivered, but an identified part or operational validation remains.
- **NOT IMPLEMENTED** — the feature is not present in the current product.
- **BLOCKED** — implementation or safe activation depends on a missing external capability, infrastructure decision, or product decision.
- **NOT VERIFIED** — no adequate evidence of actual production, accessibility, or user outcome verification is available.

| Area | Status | Current behavior and boundary |
| --- | --- | --- |
| Account creation and authentication | **PARTIALLY IMPLEMENTED** | Passwordless OTP registration/login, session rotation/revocation, logout, CSRF and Origin checks, profile editing, a dedicated OTP route, and a backend-enforced resend cooldown are implemented. The development simulator is opt-in only. Real SMS is absent, so production OTP delivery is unavailable. |
| Development OTP simulator | **IMPLEMENTED** | When explicitly enabled in development, the default local code is `123456` (configurable). The configured quick-login phone can submit this code automatically through the normal verification API; the challenge remains single-use, expires after five minutes, is stored as a keyed digest, and remains subject to rate and attempt limits. It is not a fallback for a failing production provider. |
| Profile and accessibility preferences | **IMPLEMENTED** | Profile fields include display name, optional birth year and initial balance; font scaling and high-contrast preferences are persisted and applied in the client. |
| Shared visual system and application navigation | **PARTIALLY IMPLEMENTED** | Dashboard routes share a responsive RTL shell, eight linked destinations, CSS design tokens, persisted light/dark themes, visible focus styles, and reduced-motion support. A font stack is provided without bundling an unverified font asset. Responsive behavior and theme persistence have a Playwright regression test; WCAG conformance, screen-reader behavior, contrast measurements, and real-user usability remain unverified. |
| Account deletion | **PARTIALLY IMPLEMENTED** | A fresh OTP schedules permanent deletion 30 days later and immediately revokes access; a worker checks at startup and every 60 seconds. Purge is idempotent and retries after failures. There is currently no cancellation API, and production OTP delivery remains unavailable. See [account-deletion service](../backend/src/services/accountDeletion.service.ts). |
| Personal/system categories | **PARTIALLY IMPLEMENTED** | Listing, personal category creation/editing, and activation controls are available. A guarded, development-only command seeds system categories. Physical deletion and transaction reassignment are intentionally disabled; the route returns `409 CATEGORY_DELETION_UNAVAILABLE`. Safe activation needs a transaction-capable topology or equivalent workflow and a confirmed income fallback. |
| Transactions | **IMPLEMENTED** | Owner-scoped create/list/edit, filtering, 20-item default pagination, soft deletion, ten-second server-enforced undo, Jalali date entry, and an opt-in draft are present. The pagination change now reloads the selected page. The draft is account-keyed and session-only; it is not an offline queue or sync mechanism. |
| Dashboard | **IMPLEMENTED** | Displays current Solar Hijri month income/expense totals, remaining balance based on initial balance plus current-month income minus expenses, recent transactions, and eligible upcoming reminders. |
| Monthly budgets | **IMPLEMENTED** | Owner-scoped monthly expense budgets, category constraints, exact spending totals, and normal/warning/exceeded thresholds are implemented. |
| Reminders | **PARTIALLY IMPLEMENTED** | Reminder CRUD/archive, monthly Jalali recurrence, short-month date clamping, and month-scoped completion history are implemented. SMS, email, push, and other scheduled notification delivery are not implemented. |
| Monthly reports | **IMPLEMENTED** | Owner-scoped income/expense totals, category expense shares, and comparison to the previous Jalali month are provided through the API and UI. |
| Caregiver access | **PARTIALLY IMPLEMENTED** | Invitations, explicit acceptance/rejection, granular read-only permissions, audit events, and revocation are implemented. SMS invitation delivery is absent; invitation communication must happen out of band. Production index rollout has not been verified. |
| PWA and offline use | **PARTIALLY IMPLEMENTED** | Manifest, production service worker, public offline fallback, and guarded account-keyed session draft are implemented. Authenticated/API caching, offline submission, and automatic synchronization are intentionally absent. |
| Physical category deletion | **BLOCKED** | The route exists but is intentionally disabled to prevent unsafe multi-document reassignment on standalone MongoDB and because the income fallback is unresolved. |
| SMS.ir OTP integration | **PARTIALLY IMPLEMENTED** | A server-only Verify API adapter, explicit production mode, challenge locking, sanitized provider errors, and mocked provider/authentication tests are implemented. The current official OpenAPI does not document sandbox behavior. No account key, approved template ID, exact parameter name, or real SMS outcome has been verified; live sending remains blocked on account configuration and explicit authorization. |
| Password recovery | **NOT IMPLEMENTED** | The product uses passwordless phone/OTP authentication and has no password-reset flow. Phone/account recovery policy would need a separate product decision if required. |
| Reminder/invitation notifications | **NOT IMPLEMENTED** | The app shows reminders and records caregiver invitations, but does not deliver notifications externally. |
| OCR, voice input, chatbot | **NOT IMPLEMENTED** | These ideas are outside the implemented release scope. |
| Production deployment and operations | **NOT VERIFIED** | No production deployment, operational smoke test, or production runbook verification is evidenced by this repository snapshot. |
| Database index rollout | **NOT VERIFIED** | Index definitions exist in the models, but their safe rollout against production data and topology has not been verified. |
| Accessibility/usability outcomes | **NOT VERIFIED** | UI settings and some accessibility-oriented behavior exist, but no WCAG conformance, Lighthouse score, assistive-technology audit, or real-user study has been completed. |

## Prioritized implementation and verification matrix

This matrix prioritizes the remaining work rather than proposing features for their own sake. Acceptance criteria are future gates unless the row is marked complete.

| Priority | Feature and user value | Existing implementation | Remaining work / security or data-integrity implications | Dependencies | Acceptance criteria and test coverage |
| --- | --- | --- | --- | --- | --- |
| **P0 — resolved** | Login-to-OTP navigation; users must reach a code entry screen after a request is accepted. | The browser now navigates to `/verify-otp`; a pending request is kept in tab-scoped session storage, not in the URL. | No authentication decision is made from stored client state; only the backend can verify a code and issue cookies. | None for the development simulator. | Browser tests cover accepted request/navigation, invalid request, API/network failure, direct route access without a pending request, refresh recovery, invalid code, registration, and existing-user sign-in. Backend tests cover session cookies and replay rejection. |
| **P1 — blocked externally** | Real SMS OTP delivery; necessary for production sign-in and account-deletion confirmation. | An SMS.ir Verify adapter is implemented; the development-only simulator is separately guarded by `NODE_ENV` and explicit opt-in. No live account values or template are configured. | Do not silently fall back to the fixed development code in production. Avoid logging codes, tokens, or phone identifiers; retain generic account responses and rate limits. | SMS.ir API key, approved Verify template ID and exact parameter name, account permissions/credit, and explicit authorization for a live test. Public OpenAPI does not document sandbox behavior. | Mocked provider and auth tests pass. A real test remains pending; do not claim delivery until the authorized request and handset/provider report are checked. |
| **P1 — blocked by design/infrastructure** | Safe category deletion and transaction reassignment; lets users clean up categories without losing transaction history. | The delete route explicitly returns `409 CATEGORY_DELETION_UNAVAILABLE`; category activation/deactivation remains available. | Reassignment on standalone MongoDB can race with concurrent transaction creation and produce inconsistent references. The income fallback is unresolved. | Transaction-capable MongoDB or a proven equivalent workflow, plus a confirmed income fallback. | Define type-correct fallbacks; prove concurrent reassignment/create cannot leave invalid references; test rollback/failure and owner isolation before enabling deletion. |
| **P1 — operational gate** | Reliable account lifecycle and privacy; deletion has a 30-day grace period and immediately revokes access. | OTP-confirmed scheduling, session/caregiver access revocation, periodic worker, idempotent cleanup, and retry after failure are implemented. | Safe index rollout, operational worker failure visibility, backup/retention policy, and production verification remain. The current specification does not require cancellation, so no cancellation endpoint is added without a product requirement. | Production-like MongoDB topology, index migration procedure, and operations/retention policy. | On isolated test data, verify 30-day eligibility, immediate denial, caregiver denial, retries, and idempotent cleanup; in deployment, verify indexes and worker health without destructive production tests. |
| **P1 — operational gate** | Production deployment and data integrity; protects persisted finances and account records. | Readiness endpoint, owner-scoped APIs, model indexes, and safe development/test database guards exist. | No production deployment or index rollout is verified. Index build against existing records may fail or affect availability. | Hosting environment, same-site HTTPS origins, reviewed database and backup policy, operator-approved migrations. | Deploy to a non-production environment; verify health/readiness, index uniqueness, backups/restore, safe secrets, and smoke tests before production traffic. |
| **P2 — quality gate** | Accessibility and usability for the intended older-adult audience. | Persian/RTL UI, font scaling, high contrast, and keyboard-focus styling exist. | No conformance or real-user outcome is measured; do not claim WCAG or specification UX targets without evidence. | Representative users, assistive technology, and an agreed accessibility target. | Complete keyboard, screen-reader, zoom, contrast, touch-target, and representative user testing; record measured task completion/time and audit results. |
| **P2 — optional product decision** | External reminder/invitation notifications; can help users act on scheduled items and caregiver invitations. | In-app reminders and caregiver invitation records exist. | Delivery channels, consent, privacy, retry policy, and user controls are undefined; avoid sending sensitive financial details in notifications. | Product approval and a delivery provider if required. | Define minimal notification content and opt-in/opt-out rules; test delivery failures, duplicate suppression, and access revocation before any launch. |
| **P3 — out of current scope** | OCR, voice input, or chatbot could reduce data-entry effort. | Not implemented. | Adds privacy, accuracy, accessibility, and operational risks; no implementation is justified until user research establishes value. | Product scope, privacy assessment, and suitable vetted services or models. | Approve a narrow use case and acceptance metrics before design or implementation. |

## Security, privacy, and data-handling notes

The current code and API contract document the following controls:

- Protected actions derive ownership from the authenticated identity and scope queries to that owner.
- Cookie-authenticated state changes require the configured Origin and a matching CSRF cookie/header pair. Access and refresh credentials are not intended for browser local storage.
- Request bodies are validated with Zod. Public errors use a generic response shape rather than exposing internal exception details.
- OTP requests are throttled by phone and IP; failed verification attempts are limited and can temporarily block the phone. OTP challenges and rate-limit keys use keyed digests rather than storing the OTP or raw throttle keys.
- Caregiver access is read-only, permission-checked, explicitly accepted, revocable, and audited. A revoked or invalid link must not reveal the protected user's data.
- Account deletion immediately revokes access and schedules account-related data purging. The worker is retryable and idempotent, but it is not a multi-collection MongoDB transaction.
- The PWA does not cache authenticated pages, account data, or API responses.

These observations describe implemented design controls; they are **not** a substitute for an independent security audit or production security assessment. Before launch, review secret provisioning, deployment origins/cookie settings, database access controls, rate-limit behavior under multiple instances, index migration, logging, backups, and purge obligations in the actual hosting environment.

## Verification evidence

The following checks were recorded during the current review, against the local development/test setup. They are not claims about production runtime behavior.

| Check | Result |
| --- | --- |
| Backend API/unit suite | **111 passed** using the isolated local `asoudeh_test` database, including SMS.ir request/response mocks, accepted OTP verification, rejection without OTP persistence, and the resend cooldown. |
| TypeScript typechecks | Backend and frontend typechecks passed. |
| Lint | Backend and frontend lint passed. |
| Backend production build | Passed. |
| Frontend production build | Passed; `/verify-otp` is included as a static route. |
| Jalali date tests | **3 passed.** |
| Playwright development suite (Edge, 2 workers) | **23 passed, 1 skipped.** This includes the OTP request/navigation/refresh flows, feature workflows, and the responsive application shell, route navigation, and theme persistence. The PWA production-only test is intentionally skipped in development mode. |
| Playwright authentication tests (Edge) | **14 passed**, including the development quick-login existing-account and new-account registration flows. |
| Live frontend/backend OTP smoke test (Edge) | Passed against the actual local frontend and API: OTP request, `/verify-otp`, verification, registration, authenticated settings/profile fetch, and HttpOnly access/refresh cookies. It used a unique local temporary database, which was removed afterward. |
| Playwright production PWA check (Edge) | **1 passed, 1 skipped.** The skip is for the alternate execution mode, not a successful production deployment check. |

The broader Playwright suite and auth regression tests use intercepted API responses. The separate earlier live smoke test exercised the frontend/backend registration journey on an isolated database; backend tests additionally cover replay, rate limits, resend cooldown, existing-user sessions, refresh, and logout. SMS.ir tests mock all HTTP requests. **Real SMS delivery was not tested; SMS.ir account credentials and approved template values are not configured.**

The database test uses a dedicated local URI and refuses unsupported remote or credential-bearing targets. The regular backend suite skips the database integration test when its dedicated test URI is absent. Refer to [environment setup](./ENVIRONMENT.md) before running it.

Relevant test locations include [backend tests](../backend/src/tests), [frontend browser tests](../frontend/tests), and the [Jalali date test](../frontend/tests/jalaliDate.test.mjs).

## Repository and change history

At the start of the current OTP review, `main` and `origin/main` both pointed to `b67d78c` (`feat: complete local development and project docs`). The verified remote is `https://github.com/MohamadRezaChaghomi/asoudeh.git`. The committed history includes the authentication/backend foundation, transaction and dashboard work, budgets, reminders, caregiver/report/PWA/account-deletion milestones, local OTP simulator, readiness checks, pagination fix, and project documentation.

The current OTP-flow changes are **not committed or pushed**:

- Root cause correction and separate verification page: `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/verify-otp/page.tsx`, and `frontend/lib/auth/otpFlow.ts`.
- OTP regression tests: `frontend/tests/auth.spec.ts`.
- Resend cooldown configuration and atomic server enforcement: `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/models/OtpChallenge.ts`, `backend/src/services/auth.service.ts`, and `backend/src/tests/auth.api.test.ts`.
- Current documentation updates: [README](../README.md), [API](./API.md), [decisions](./DECISIONS.md), [environment](./ENVIRONMENT.md), this report, and [handover](./PROJECT_HANDOVER.md).

No commit or push was made for this OTP-flow task.

## Recommended next steps

1. **Before any production login:** enter the SMS.ir account values into the ignored backend environment, confirm template approval/parameter mapping and credit, explicitly select production, and verify a user-authorized test; keep the development simulator unavailable in non-development environments.
2. **Before production traffic:** review MongoDB topology, credentials, backups, and access controls; safely deploy and verify the required indexes against real data; verify the deletion worker and retention behavior operationally.
3. **Resolve category deletion:** choose a valid fallback for both expense and income categories and implement reassignment with concurrency safety; otherwise keep the existing explicit `409` behavior.
4. **Account-deletion cancellation:** the reviewed specification does not require a cancellation route. Keep the current behavior unless the product explicitly adopts a cancellation requirement, then define identity verification and session behavior before implementation.
5. **Complete accessibility validation:** run keyboard, screen-reader, contrast, zoom, and mobile touch checks, then measure the specified Lighthouse/accessibility goals. Do not report a score or conformance level before measurement.
6. **Run usability studies:** evaluate core tasks with representative older adults and less-experienced users, measure task completion and time, and prioritize observed blockers.
7. **Add operational readiness:** choose deployment targets, configure environment secrets and same-site HTTPS origins, add CI checks, and execute production-like readiness and recovery drills.
8. **Reassess optional scope:** only prioritize notifications, OCR, voice, or chatbot features after product and privacy requirements are defined.

## Source documents

- [README](../README.md)
- [API contract](./API.md)
- [Environment setup](./ENVIRONMENT.md)
- [Development guide](./DEVELOPMENT.md)
- [Implementation decisions](./DECISIONS.md)
- [Roadmap](./ROADMAP.md)
- [Project handover](./PROJECT_HANDOVER.md)
- [Original product specification](./SPECIFICATION.pdf)
