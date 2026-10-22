# Asoudeh

Asoudeh is a Persian, right-to-left personal finance web application designed to make everyday money management approachable for older adults and people with limited experience using financial software. It supports personal transactions, budgets, reminders, monthly reports, and optional read-only caregiver access.

> **Development status:** This repository is not production-ready. A server-side SMS.ir Verify adapter is implemented, but no account credentials/template are configured and no live delivery has been verified. Local OTP login is available through an explicitly enabled development simulator.

## Product capabilities

- Persian/RTL interface with profile-level font scaling and high-contrast settings.
- OTP-based, passwordless registration and login, cookie-backed sessions, CSRF and Origin checks, profile editing, and account deletion scheduled 30 days after OTP confirmation.
- Personal and read-only system categories; owner-scoped transaction management, soft deletion with a 10-second undo window, and 20-item pagination.
- Solar Hijri dashboard, monthly budgets, recurring reminders with month-scoped completion, and monthly reports.
- Explicitly accepted, permission-scoped, read-only caregiver access with revocation and audit events.
- Optional, account-keyed session-only transaction draft storage.
- A PWA manifest and a limited offline shell. Only a generic public offline page and its icon are cached; authenticated pages and API data are not cached.

See the [engineering report](docs/PROJECT_REPORT.md) for implementation status, verification evidence, limitations, and recommended next steps. The [API contract](docs/API.md) distinguishes registered routes from planning notes.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 4, TypeScript, Zod |
| Persistence | MongoDB, Mongoose |
| Tests | Vitest, Supertest, Node test runner, Playwright |

## Repository layout

```text
backend/      Express API, validation, services, Mongoose models, and API/unit tests
frontend/     Next.js application, shared UI, Jalali date utilities, and browser tests
docs/         API, environment, development, decisions, roadmap, handover, and specification
scripts/      Repository helper scripts
```

The backend follows a routes/controllers/services/models structure. The frontend uses the Next.js App Router and calls the API through cookie-based authentication.

## Requirements

- Node.js `22.14.0` or newer (the repository pins `22.14.0` in `.nvmrc`).
- npm.
- A local MongoDB instance for the application and database integration tests.

## Local development (PowerShell)

Run these commands from the repository root. They create local environment files only when they do not already exist, so existing local configuration is not overwritten:

```powershell
if (-not (Test-Path 'backend\.env')) {
    Copy-Item 'backend\.env.example' 'backend\.env'
}
if (-not (Test-Path 'frontend\.env.local')) {
    Copy-Item 'frontend\.env.example' 'frontend\.env.local'
}
npm run install:all
```

Review the sample files and configure local values in `backend\.env` and `frontend\.env.local`:

- Set independent, randomly generated values for `JWT_SECRET` and `AUTH_HASH_SECRET`. `AUTH_HASH_SECRET` must be at least 32 bytes. Authentication fails closed if it is missing or too short.
- Keep `MONGODB_URI` pointed at a local development database and `CLIENT_URL` at the frontend origin.
- `NEXT_PUBLIC_API_URL` is public configuration; never place secrets in it.
- Never commit or print local `.env` files or their secret values.

Start MongoDB, then run the backend and frontend in separate PowerShell terminals:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

The frontend is at <http://localhost:3000>. The API is at <http://localhost:5000>; liveness and database readiness are available at `/api/v1/health` and `/api/v1/health/ready`.

### Local OTP without an SMS provider

For local development, set `NODE_ENV=development`, `OTP_DEV_SIMULATOR_ENABLED=true`, and `OTP_DEV_QUICK_LOGIN_ENABLED=true` in the backend's local environment file. The login page is prefilled with `09120000000`; submitting that number automatically sends the simulator's default OTP (`123456`) to the backend verification endpoint, so no code entry is required. A new account still needs a display name once. Other phone numbers continue through the normal OTP verification screen.

The development OTP is single-use, expires after five minutes, is stored as a keyed digest, and retains the application's rate and attempt limits. Resends have a server-enforced cooldown (60 seconds by default). Quick login is accepted only for `OTP_DEV_QUICK_LOGIN_PHONE` (default `09120000000`) and only when `NODE_ENV=development`; the server still verifies and consumes the OTP before issuing a session. It is not an automatic fallback when a production SMS delivery fails. Never enable the simulator or quick login outside local development or use them with shared or production data. More detail is in [environment setup](docs/ENVIRONMENT.md).

SMS.ir OTP delivery is server-side and requires account-specific API key, approved Verify template ID, and exact template parameter name. The adapter does not send in `SMSIR_MODE=sandbox` because the published official OpenAPI does not document a sandbox endpoint or behavior. Real paid delivery requires explicitly setting `SMSIR_MODE=production`; no live SMS has been sent or tested. See [SMS.ir setup](docs/SMSIR_SETUP.md).

For regular numbers, an accepted OTP request navigates to `/verify-otp`. The pending phone and development-only simulator code are kept in the current tab's session storage so refresh can recover the form; this client-side state never authenticates a user. Only successful backend OTP verification issues an authenticated session.

## Checks and tests

Run commands from the repository root:

```powershell
npm run typecheck
npm run lint
npm run test:backend
npm --prefix frontend run test:jalali
npm run build:backend
npm run build:frontend
```

Playwright browser tests are run separately:

```powershell
npm --prefix frontend run test:e2e
```

The backend database integration test is skipped by the regular suite unless `TEST_MONGODB_URI` is configured. It must point to a dedicated local `asoudeh_test` database without credentials. Follow the guarded instructions in [environment setup](docs/ENVIRONMENT.md); do not point test commands at a shared or production database.

Available root scripts are declared in the root `package.json`. Backend and frontend scripts are declared in their respective package manifests; there is no root script that runs every E2E/browser test.

## Known limitations

- **Production OTP delivery is not configured:** SMS.ir credentials and an approved template are missing. Production requests fail closed instead of returning a development code.
- **Category deletion is intentionally unavailable:** the registered delete route returns `409 CATEGORY_DELETION_UNAVAILABLE`; safely reassigning transactions requires a transaction-capable database topology or an equivalent safe workflow, and a confirmed income fallback.
- **No reminder or caregiver invitation delivery:** reminders are shown in the app, and caregiver invitations must be communicated out of band.
- **Account deletion cannot currently be cancelled:** access is revoked immediately and permanent purge is scheduled for 30 days later.
- **Offline behavior is limited:** the public offline page is cached, but account/API data and automatic offline transaction submission or synchronization are not supported.
- **Not production-verified:** deployment, production index rollout, WCAG/Lighthouse results, and real-user usability studies have not been verified. OCR, voice, and chatbot features are not implemented.

There is no `LICENSE` file in the repository. No deployment URL, demo, screenshot, or CI status is claimed here.

## Documentation

- [Project engineering report](docs/PROJECT_REPORT.md)
- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Quality audit report](docs/QUALITY_AUDIT_REPORT.md)
- [API contract](docs/API.md)
- [Environment setup and safe database testing](docs/ENVIRONMENT.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Architecture and security decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Project handover](docs/PROJECT_HANDOVER.md)
- [Original specification (PDF)](docs/SPECIFICATION.pdf)
- [Git workflow notes](docs/GIT.md)

## Source

Repository: <https://github.com/MohamadRezaChaghomi/asoudeh>
