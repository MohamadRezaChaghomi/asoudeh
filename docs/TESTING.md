# Test guide

## Test layers

| Layer | Location/tool | Scope and limitations |
|---|---|---|
| Backend unit/API | `backend/src/tests/`, Vitest, Supertest | Auth/session, account deletion, ownership, finance features, assistant, health, date helpers, and SMS provider behavior. API suites need an isolated local MongoDB test database. |
| SMS provider unit | `smsIrProvider.unit.test.ts`, Vitest | Mocks `fetch`; checks request URL/method/headers/body, response parsing, HTTP/API errors, timeout, and no retry. It makes no HTTP request to SMS.ir. |
| Optional SMS Sandbox | `smsIrSandbox.integration.test.ts` | Sends one real HTTP request only when `SMSIR_SANDBOX_TEST_ENABLED=true` and an explicitly controlled mobile is configured. A successful response proves API acceptance only. |
| Frontend utility | `frontend/tests/jalaliDate.test.mjs`, Node test runner | Jalali conversion, calendar boundaries, and year formatting. |
| Browser end-to-end | `frontend/tests/*.spec.ts`, Playwright | Authentication UI, app shell, responsive pages, transactions, budgets, reminders, reports/caregiver, public pages, assistant UI, and PWA behavior. API calls are mocked for these flows; browser tests do not send SMS. |

## Commands

Run from the repository root unless noted:

```powershell
npm run lint
npm run typecheck
npm run test:backend
npm --prefix backend run test:coverage
npm --prefix frontend run test:jalali
npm run build:backend
npm run build:frontend
```

Install the Playwright browser once if needed, then run browser tests:

```powershell
npm --prefix frontend run test:e2e
```

The Playwright origin defaults to `http://localhost:3000` to match the backend's default `CLIENT_URL`. If `PLAYWRIGHT_BASE_URL` uses another hostname, configure `CLIENT_URL` to match it; `localhost` and `127.0.0.1` are different browser origins and a mismatch will block API requests through CORS.

To run the production PWA path in Microsoft Edge:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PWA_TEST = 'true'
Set-Location frontend
npx playwright test
Set-Location ..
Remove-Item Env:PLAYWRIGHT_CHANNEL
Remove-Item Env:PWA_TEST
```

## Safe backend API-test setup

API tests connect only through `TEST_MONGODB_URI`, but backend configuration also requires `MONGODB_URI` to be present. Use the same credential-free local test database for both variables, and synthetic test-only signing secrets. Never use a shared or production database.

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

The database test refuses non-local hosts, other database names, and credential-bearing URIs; it only pings the server. API tests clean up their own fixtures. Check the test source and target URI before changing these guards.

## Explicit SMS Sandbox check

This is not part of automated unit or API tests. It performs one real request to SMS.ir and may be processed by the provider:

```powershell
$env:SMSIR_SANDBOX_TEST_ENABLED = 'true'
$env:SMSIR_SANDBOX_TEST_MOBILE = 'a-mobile-number-you-control'
npm --prefix backend run test:smsir:sandbox
Remove-Item Env:SMSIR_SANDBOX_TEST_ENABLED, Env:SMSIR_SANDBOX_TEST_MOBILE
```

Configure valid Sandbox credentials in the backend environment first. Never run with production credentials or for a number you do not control. Do not interpret provider acceptance as handset delivery.

## Verification snapshot (2026-11-09)

Coverage was collected with Vitest V8 using the test database and synthetic test-only secrets documented above. This baseline predates the focused regression tests added below.

| Check | Result |
|---|---|
| Backend coverage run (`npx vitest run --coverage --coverage.reporter=text`) on local `asoudeh_test` | **159 passed, 1 skipped** (18 test files passed, 1 skipped; 19 files total); **87.80% statements, 88.43% lines**. The SMS Sandbox opt-in was disabled. |
| Latest backend suite and explicit database test on local `asoudeh_test` | **167 passed, 1 skipped** in the full suite; **6 passed** in `test:db`. |
| Lowest line coverage among critical backend runtime files | See the ranked table below; the two assistant rows are low because assistant provider behavior is separately mocked and has narrow service coverage. |
| Focused backend regression files | **59 passed across 5 files**: auth, transactions, budgets, caregiver, and reminder calendar. |
| Full frontend Playwright suite (Edge, one worker) | **67 passed, 1 skipped**. |
| Frontend Jalali utility spec | **7 passed**. |
| Production PWA Playwright spec (`PWA_TEST=true`, Edge) | **1 passed, 1 skipped**; the development-only service-worker test is skipped by design. |
| Frontend production build; backend/frontend typecheck and lint | **Passed**. |
| Production dependency audits (`npm audit --omit=dev`) | **0 vulnerabilities** in both backend and frontend. |

These are local automated checks, not a production deployment test or live SMS verification.

### Ten lowest-covered critical backend files (baseline)

| Rank | File | Line coverage |
|---:|---|---:|
| 1 | `backend/src/services/assistant.service.ts` | 8.00% |
| 2 | `backend/src/controllers/assistant.controller.ts` | 22.22% |
| 3 | `backend/src/utils/financialAmount.ts` | 47.05% |
| 4 | `backend/src/config/db.ts` | 66.66% |
| 5 | `backend/src/services/assistantProvider.ts` | 66.66% |
| 6 | `backend/src/utils/restoreCheckSafety.ts` | 71.42% |
| 7 | `backend/src/middleware/requireOrigin.ts` | 75.00% |
| 8 | `backend/src/controllers/dashboard.controller.ts` | 80.00% |
| 9 | `backend/src/models/Budget.ts` | 80.00% |
| 10 | `backend/src/models/User.ts` | 80.00% |

The requested high-risk regression areas also have focused additions in auth, transaction undo boundaries, exact budget thresholds, caregiver write denial, and Jalali reminder recurrence.

## Remaining coverage limits

- Frontend category list/create/edit/activation and unavailable-delete behavior now has a dedicated E2E spec.
- Accessibility settings and keyboard behavior have tests, but no measured WCAG conformance, screen-reader certification, or real-user usability study is recorded.
- Production deployment, database index rollout, backup/restore, and real provider delivery are not covered by the automated suites.
- SMS Sandbox is deliberately opt-in and was not run in this audit.
