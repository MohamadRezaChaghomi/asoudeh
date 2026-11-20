# Asoudeh

Asoudeh is a Persian, right-to-left personal-finance web application. It helps people record and review income and expenses, organize spending with categories and monthly budgets, manage reminders, and view monthly reports. An account owner can optionally grant a caregiver explicitly accepted, permission-scoped, read-only access.

The product is designed for older adults and people who benefit from a simpler financial interface. It does not connect to banks, move money, or provide financial, tax, or legal advice.

> **Project status:** Core application flows are implemented and covered by automated tests, but the project is **not production-certified**. Live SMS delivery, production operations, database index rollout, backup/restore drills, formal accessibility conformance, and real-user usability have not been verified.

## What it includes

- Persian/RTL web UI with light/dark themes, profile-level text scaling, and high-contrast settings.
- Passwordless OTP registration and login, HTTP-only session cookies, CSRF/Origin checks, refresh rotation, and idle expiry.
- Owner-scoped transactions, categories, Solar Hijri monthly budgets, reminders, dashboard summaries, and monthly reports.
- Optional caregiver access that requires explicit acceptance, individual read permissions, and can be revoked.
- An optional Persian guide assistant. It remains unavailable until configured on the backend and receives the question plus selected public guide text—not financial records.
- Browser text-to-speech when a Persian system voice is available.
- A PWA manifest and limited offline shell. Only a generic offline page and its mark are cached; authenticated pages and API data are not.

## Technology and prerequisites

| Area | Technology |
| --- | --- |
| Runtime | Node.js `22.14.0` or newer; version is pinned in `.nvmrc` |
| Package manager | npm |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3 |
| Backend | Node.js, Express 4, TypeScript, Zod |
| Database | MongoDB with Mongoose |
| Tests | Vitest, Supertest, Node test runner, Playwright |

For local development, install Node.js and npm and run a local MongoDB instance. Docker is optional for development; the staging Compose file starts MongoDB as a replica set with the application and Caddy.

## Local setup

Run the following from the repository root in PowerShell. These commands create environment files only if they do not already exist:

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

- Keep `MONGODB_URI` pointed to a local development database (the sample uses `asoudeh`).
- Set `CLIENT_URL=http://localhost:3000` and `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1` for the default local ports.
- Use separate random values for `JWT_SECRET` and `AUTH_HASH_SECRET`; the authentication hash secret must be at least 32 bytes.
- `NEXT_PUBLIC_API_URL` is public configuration. Never put credentials or secrets in a `NEXT_PUBLIC_*` variable.
- Never print, commit, overwrite, or share local `.env` files or their secret values.

Start MongoDB, then open two PowerShell terminals at the repository root:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

The frontend is served at <http://localhost:3000>; the API listens on port `5000`. The liveness endpoint is `GET /api/v1/health`; readiness, including MongoDB availability, is `GET /api/v1/health/ready`.

### Local OTP without SMS

The backend sample enables the development-only OTP simulator. It requires `NODE_ENV=development`; the configured fallback code must be entered manually on `/verify-otp`. The API never returns the code, and the browser does not store it. Use only a dedicated local database. The simulator is not an automatic fallback for SMS delivery failures and must be disabled outside local development.

SMS.ir delivery is backend-only and requires approved credentials and an active Verify template. A successful provider response, especially in Sandbox, confirms API acceptance only—not handset delivery. No live SMS delivery has been verified. See [SMS.ir setup](docs/SMSIR_SETUP.md).

## Architecture

```text
Browser
  └─ Next.js App Router UI
       └─ frontend/lib/api/client.ts
            └─ Express API (/api/v1)
                 ├─ middleware and route validation (Zod)
                 ├─ controllers
                 ├─ domain services
                 └─ Mongoose models ── MongoDB
```

### Repository layout

```text
backend/
  scripts/           Database maintenance and reporting commands
  src/
    config/          Environment validation and database connection
    controllers/     HTTP request/response handlers
    middleware/      Authentication, CSRF, Origin, errors and logging
    models/          Mongoose schemas and indexes
    routes/          Express route registration
    services/        Authentication and domain/business logic
    tests/           API, integration and unit tests
    validators/      Zod request schemas
    utils/            Shared backend helpers
frontend/
  app/               App Router routes, layouts, metadata and global CSS entry
  components/        Shared shell, brand, forms and UI components
  lib/               API client, auth-flow, Persian content and date/amount helpers
  public/            PWA shell, icons, illustrations and social preview
  scripts/           Type generation, performance budget and asset export
  styles/            Design tokens and modular global styles
  tests/             Playwright and Node utility tests
docs/                API, architecture, security and operations references
scripts/             Repository-level backup, restore and helper scripts
```

### Request and data flow

1. The Next.js UI calls the centralized API client in `frontend/lib/api/client.ts`, which sends credentialed requests and handles CSRF bootstrap, refresh/retry, and API error messages.
2. Express applies security headers, CORS, request logging, JSON size limits, and request timeouts before dispatching to feature routers.
3. Validators parse untrusted input. Controllers adapt HTTP requests to service calls; services enforce business rules and ownership.
4. Mongoose models persist and query MongoDB documents. Personal financial records are always scoped to the authenticated user; caregiver reads require an accepted relationship and the specific permission.
5. Authentication uses cookies rather than access or refresh tokens in browser storage. State-changing requests require the configured Origin and CSRF cookie/header pair.

For the full registered request contract and response/error shapes, see [API.md](docs/API.md). For implementation boundaries and diagrams, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Main API families

All versioned endpoints use `/api/v1`.

| Family | Representative routes | Purpose |
| --- | --- | --- |
| Health | `GET /health`, `GET /health/ready` | Liveness and MongoDB readiness |
| Authentication | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/activity` | OTP flow and cookie-backed sessions |
| Profile | `GET /me`, `PATCH /me/profile` | Current profile and accessibility preferences |
| Transactions | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id`, `POST /transactions/:id/restore` | Owner-scoped records, filters and undo |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` | System and personal categories; physical deletion is intentionally disabled |
| Dashboard and budgets | `GET /dashboard`, `GET/POST /budgets`, `PATCH/DELETE /budgets/:id` | Monthly totals and Solar Hijri budgets |
| Reminders and reports | `/reminders`, `GET /reports/monthly` | Reminder lifecycle and monthly reports |
| Caregiver | `/caregiver/links`, `/caregiver/invitations`, `/caregiver/seniors` | Accepted permission-scoped read-only access |
| Assistant | `GET /assistant/status`, `POST /assistant/messages` | Optional public-guide help, disabled until configured |

Some endpoints require cookies, CSRF, Origin, or query parameters; consult [the API contract](docs/API.md) before calling them.

### Data model overview

| Model | Responsibility |
| --- | --- |
| `User`, `AuthSession`, `OtpChallenge`, `OtpRateLimit` | Accounts, refresh-session state and protected OTP challenges/limits |
| `Category`, `Transaction`, `Budget` | System/personal categories and owner-scoped financial records |
| `Reminder`, `ReminderCompletion` | Recurring reminders and idempotent Solar Hijri month completion |
| `CaregiverLink`, `AuditLog` | Accepted access grants, revocation and access audit events |
| `AssistantRateLimit` | Per-user assistant request limits; conversation content is not persisted |

Amounts are denominated in toman. Financial dates and monthly periods use Solar Hijri rules where applicable; APIs return exact aggregate amounts as integer strings. Model fields, indexes, ownership and migration cautions are documented in [DATABASE.md](docs/DATABASE.md).

## Development and verification

Run from the repository root:

```powershell
npm run lint
npm run typecheck
npm run test:backend
npm --prefix frontend run test:jalali
npm run test:e2e
npm run build:backend
npm run build:frontend
```

Install the Playwright browser if it is not already available. If the machine is resource constrained, run Playwright from the frontend directory with one worker:

```powershell
Set-Location frontend
npx playwright test --workers=1
Set-Location ..
```

Backend API tests require **both** `MONGODB_URI` and `TEST_MONGODB_URI` to target the credential-free local `asoudeh_test` database. The tests refuse unsafe targets. Never point test commands at a shared, development, or production database. Follow the guarded instructions in [TESTING.md](docs/TESTING.md).

The frontend bundle/image budget can be checked with:

```powershell
npm --prefix frontend run perf:budget
```

CI checks are defined in `.github/workflows/ci.yml`. Current feature verification is not a production deployment, live-provider check, WCAG certification, or usability study.

## Deployment

The repository includes Dockerfiles, `docker-compose.staging.yml`, and a Caddy reverse-proxy configuration. The Compose setup requires deployment environment values such as `DOMAIN`, database URI, MongoDB credentials, distinct authentication secrets, and SMS.ir Verify credentials; do not put real values in tracked files.

For production builds, `NEXT_PUBLIC_API_URL` must be an HTTPS API URL. Set `NODE_ENV=production`, disable the development OTP simulator, configure production secrets and origins, and use the required MongoDB replica set. Review backup/restore, index rollout, deletion-worker monitoring, health checks, and rollback before exposing traffic. The checked-in deployment setup is a staging scaffold and has not been production-verified.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md), [ENVIRONMENT.md](docs/ENVIRONMENT.md), and [BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) for operational requirements and safety steps.

## Contributing

1. Start from the maintained project branch and create a focused feature or fix branch.
2. Keep changes scoped; preserve unrelated worktree changes and never commit environment files, generated secrets, test data, or build outputs.
3. Follow the existing TypeScript, route/controller/service/model, validation, CSS-token, and test patterns. Avoid broad refactors bundled with behavior changes.
4. Add or update focused tests for new behavior and safety boundaries. Run the relevant tests plus lint/typecheck; run builds before proposing release-impacting changes.
5. Review the final diff and staged file list before committing. Stage only intentional files rather than using a blanket `git add .`.
6. Open a Pull Request with a concise problem statement, implementation summary, verification results, screenshots for UI changes, and any migration/configuration notes.

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for local workflow and [GIT.md](docs/GIT.md) for safe Git guidance.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend refuses to start | `NODE_ENV` must be explicitly set to `development`, `test`, or `production`; check the backend environment template and required secrets. |
| API readiness returns `503` | Confirm local MongoDB is running and `MONGODB_URI` points to the intended development database. |
| Browser API requests fail through CORS | `CLIENT_URL` must exactly match the browser origin. `localhost` and `127.0.0.1` are different origins. |
| Production frontend build rejects API URL | Set `NEXT_PUBLIC_API_URL` to an HTTPS URL; never include credentials. |
| OTP request returns `503` | The simulator must be enabled only for local development, or valid SMS.ir settings must be configured on the backend. The API does not reveal the OTP. |
| Backend API tests stop before running | Configure both MongoDB variables to the isolated local `asoudeh_test` database; do not bypass the safety guard. |
| Playwright cannot launch a browser | Install the configured Playwright browser and rerun from `frontend/` or use the root `npm run test:e2e` script. |

## Documentation map

- [API contract](docs/API.md) — registered routes and response behavior.
- [Architecture](docs/ARCHITECTURE.md) — component boundaries and request flow.
- [Database](docs/DATABASE.md) — models, indexes, ownership and data cautions.
- [Security](docs/SECURITY.md) — auth, cookies, CSRF, privacy and operational risks.
- [Environment](docs/ENVIRONMENT.md) — environment variables and safe test database setup.
- [Testing](docs/TESTING.md) — test layers, commands, current verification and limitations.
- [Deployment](docs/DEPLOYMENT.md) and [backup/recovery](docs/BACKUP_RECOVERY.md) — operational checklists.
- [SMS.ir setup](docs/SMSIR_SETUP.md) — provider flow and explicitly opt-in Sandbox test.
- [Decisions](docs/DECISIONS.md) and [roadmap](docs/ROADMAP.md) — product/engineering decisions and planned work.
- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md) — dated requirement evidence snapshot.
- [Brand guidance](docs/brand/BRAND-GUIDELINES.md) — approved marks, palette and typography.
- [Performance audit](docs/PERFORMANCE_AUDIT.md) — historical performance measurements, not current field metrics.
- [Engineering course report](docs/ASOUDEH_SOFTWARE_ENGINEERING_REPORT.md) — academic analysis; not the operational source of truth.

No `LICENSE` file is currently included. Confirm licensing with the maintainers before redistributing this project.
