# Testing, Performance, and Requirements Evidence

## Test layers

| Layer | Location/tool | Scope and limitations |
|---|---|---|
| Backend unit/API | `backend/src/tests/`, Vitest, Supertest | Auth/session, account deletion, ownership, finance features, assistant, health, date helpers, and SMS-provider behavior. API suites require an isolated local MongoDB database. |
| SMS provider unit | `smsIrProvider.unit.test.ts` | Mocks `fetch`; makes no request to SMS.ir. |
| Optional SMS Sandbox | `smsIrSandbox.integration.test.ts` | Sends one real HTTP request only after explicit opt-in with a number you control. Acceptance does not prove delivery. |
| Frontend utility | `frontend/tests/jalaliDate.test.mjs`, Node test runner | Jalali conversion, calendar boundaries, and year formatting. |
| Browser E2E | `frontend/tests/*.spec.ts`, Playwright | App shell, auth UI, responsive pages, feature flows, public pages, assistant UI, and PWA behavior. API calls are mocked for these flows; browser tests do not send SMS. |

## Commands

Run from the repository root:

```powershell
npm run lint
npm run typecheck
npm run test:backend
npm --prefix backend run test:coverage
npm --prefix frontend run test:jalali
npm run test:e2e
npm run build:backend
npm run build:frontend
npm --prefix frontend run perf:budget
```

Playwright uses `.next-playwright` so test chunks do not overwrite a concurrent development build. Install the configured browser first if needed. The production PWA path is separate from the default development browser run.

## Safe backend API-test setup

The backend requires both MongoDB environment variables to point to a credential-free, local `asoudeh_test` database. Never point tests at a shared, development, or production database. The guard refuses remote hosts, other database names, and credential-bearing URIs.

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/asoudeh_test'
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/asoudeh_test'
$env:JWT_SECRET = 'test-only-jwt-secret-not-for-use'
$env:AUTH_HASH_SECRET = 'test-only-auth-hash-secret-32-bytes-minimum'
$env:OTP_DEV_SIMULATOR_ENABLED = 'false'
$env:SMSIR_API_KEY = ''
$env:SMSIR_SANDBOX_TEST_ENABLED = 'false'
npm run test:backend
Remove-Item Env:MONGODB_URI, Env:TEST_MONGODB_URI, Env:JWT_SECRET, Env:AUTH_HASH_SECRET, Env:OTP_DEV_SIMULATOR_ENABLED, Env:SMSIR_API_KEY, Env:SMSIR_SANDBOX_TEST_ENABLED
```

The explicit database check only pings MongoDB. API suites clean up their own fixtures; inspect their target URI and test source before changing any safety checks.

## Current checkout verification (2026-11-21)

The full browser suite ran before the final removal of unused files; focused UI and brand regressions were rerun afterward. Database-backed backend API suites did not complete because the configured URIs did not satisfy the isolated local `asoudeh_test` guard.

| Check | Result |
|---|---|
| Frontend lint, typecheck, and production build | Passed |
| Backend lint, typecheck, and production build | Passed |
| Full frontend Playwright suite, one worker | 72 passed, 1 intentionally skipped (production-only PWA coverage) |
| Focused frontend app-shell/transaction tests after cleanup | 16 passed |
| Brand assets, logo dimensions, ICO, and contrast tests after cleanup | 4 passed |
| Frontend Node utility tests | 8 passed |
| Backend database-independent unit tests | 59 passed across 6 files |
| Frontend performance budget | Passed: JS 1,171,392 / 1,400,000 bytes; largest JS 219,011 / 300,000; public images 163,403 / 200,000; largest image 49,357 / 100,000 bytes |
| Full backend suite | Incomplete: 8 API test files stopped at the local-database guard; 114 tests passed and 55 were skipped in that attempt. These counts are not a full-suite pass. |

No guard was bypassed, no environment values were changed, and no SMS was sent in these checks. This is local automated evidence, not production certification or user research.

## Historical performance measurements

The following measurements are dated local observations, not current field metrics:

| Measurement | Before | After | Context |
|---|---:|---:|---|
| Reports First Load JS | 238 kB | 136 kB | 2026-11-04 report route; chart moved to a dynamically loaded chunk. The chart remains available; this is an initial-bundle reduction. |
| Reports route JS | 106 kB | 4.9 kB | 2026-11-04 production build. |
| Home-page LCP | 1,963 ms | 1,951 ms | 2026-11-09 one local Lighthouse mobile navigation run; not field data. |
| Home-page CLS | 0.000 | 0.000 | Same local Lighthouse runs. |
| INP | Not reported | Not reported | No qualifying interaction produced a reportable value; no numeric INP is claimed. |

A separate local fixture with 50,000 transactions recorded these API p95 latencies on 2026-11-09:

| Endpoint | Median | p95 | Query explain time |
|---|---:|---:|---:|
| Dashboard | 18.1 ms | 23.3 ms | 6 ms |
| Monthly report | 18.1 ms | 24.0 ms | 5 ms |
| First transaction page (100 rows) | 24.1 ms | 45.4 ms | 5 ms |
| Transaction-list count | — | — | 18 ms |

The fixture scripts are restricted to local `asoudeh_test`; these timings do not establish production performance. Earlier single-run home-page browser observations and historical bundle/audit details are retained in the dated [academic project report](./Project_Report.md). Lighthouse/field Web Vitals, INP, representative-device/network performance, and production API latency remain unverified.

## Requirements traceability summary

Status definitions: **PASS** means the documented behavior has supporting automated or direct runtime evidence; **PARTIAL** means core behavior exists but a limitation or environment remains; **BLOCKED** means a dependency or safety decision prevents completion; **NOT VERIFIED** means evidence is insufficient. A route or component alone does not establish completion.

| Requirements | Current evidence summary | Remaining limitation |
|---|---|---|
| FR-01–03: OTP, attempt limits, and sessions | Local code and automated flows cover challenges, cookies, CSRF/Origin, refresh rotation, and idle expiry. | Live SMS, production cookie/origin setup, and real multi-tab behavior are not verified. |
| FR-04–10: profile and transaction lifecycle | Profile settings, owner-scoped transaction CRUD, filters, pagination, soft deletion, and server-enforced undo have focused coverage. | Not every filter combination or failure state is exhaustively tested. |
| FR-11: categories | Listing, personal CRUD/activation, and ownership are tested. | Physical deletion/reassignment intentionally returns `409` until a concurrency-safe design and type-correct fallback are agreed. |
| FR-12: monthly budgets | Unique owner/category/month assignment and exact threshold calculations are tested. | Production index rollout is unverified. |
| FR-13: reminders | CRUD/archive, Jalali recurrence, and idempotent month completion are covered. | External notification delivery is not implemented. |
| FR-14–15: dashboard and reports | Owner-scoped monthly aggregation and report behavior have backend test coverage. | Full backend API suites did not run in the current environment. |
| FR-16: accessibility preferences | Profile font scale, contrast preference, and related browser behaviors are tested. | WCAG 2.2 AA conformance and real assistive-technology behavior are not certified. |
| FR-17–19: caregiver | Explicit acceptance, permission-scoped reads, and revocation are covered locally. | Invitation notification is out of band; production indexes are unverified. |
| FR-20–21: data isolation and recoverable errors | Owner-scoped services, error shapes, and selected retries have tests. | No formal penetration test; some UI failure states remain untested. |
| FR-22: account deletion | OTP-confirmed scheduling and purge logic are implemented. | Production worker health/indexes and operational recovery are unverified; cancellation is not available. |
| FR-23–28: assistant, browser speech, PWA, draft, health, public content | Optional/limited implementations and their selected local behavior are documented in tests. | Provider approval, production PWA, offline sync, accessibility, and complete UX coverage are not established. |
| NFR-01–06 | Security and modular architecture controls exist; some local measurements and automated checks are recorded. | WCAG conformance, cross-browser/device support, representative-user study, production security, and target-network performance remain unverified. |

The detailed dated requirement matrix is preserved in [Project_Report.md](./Project_Report.md), including test references and explicit evidence limits.
