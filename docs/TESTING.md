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
npm --prefix frontend run test:jalali
npm run build:backend
npm run build:frontend
```

Install the Playwright browser once if needed, then run browser tests:

```powershell
npm --prefix frontend run test:e2e
```

To run the production PWA path in Microsoft Edge:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PWA_TEST = 'true'
Set-Location frontend
npx playwright test --workers=4
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

## Verification snapshot (2026-11-02)

The following commands were executed for this audit:

| Check | Result |
|---|---|
| Backend complete suite with explicit local `asoudeh_test`, synthetic secrets, SMS key empty, and Sandbox opt-in disabled | **116 passed, 1 skipped** (17 test files passed, 1 skipped; 18 files total). No real SMS request was made. |
| Frontend Edge production browser suite (`PWA_TEST=true`, 4 workers) | **37 passed, 1 skipped**. The development-only service-worker test is skipped by design. |
| Frontend Jalali utility tests | **4 passed**; Node emitted experimental type-stripping/module-type warnings. |
| Backend and frontend production builds | **Passed**. |
| Frontend/backend lint and typecheck | **Passed** in the preceding verification run for this same code state. |
| SMS.ir provider unit tests | **12 passed**, with mocked `fetch`; no network request. |

These are local automated checks, not a production deployment test or live SMS verification.

## Coverage gaps

- There is no configured coverage-collection script in the package manifests.
- Frontend has no dedicated category feature E2E spec; shell navigation alone does not verify category editing behavior.
- Accessibility settings and keyboard behavior have tests, but no measured WCAG conformance, screen-reader certification, or real-user usability study is recorded.
- Production deployment, database index rollout, backup/restore, and real provider delivery are not covered by the automated suites.
- SMS Sandbox is deliberately opt-in and was not run in this audit.
