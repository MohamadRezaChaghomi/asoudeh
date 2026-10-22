# Environment

Use Node.js `22.14.0` or newer. The repository pins `22.14.0` in `.nvmrc`.

## Backend
Copy `backend/.env.example` to `backend/.env` only if a local file does not already exist. Configure separate random values for `JWT_SECRET` and `AUTH_HASH_SECRET`; never commit the resulting `.env`.

For local development without SMS, set `OTP_DEV_SIMULATOR_ENABLED=true` while `NODE_ENV=development`. To skip manual code entry for the dedicated local account, also set `OTP_DEV_QUICK_LOGIN_ENABLED=true`; the login form uses `OTP_DEV_QUICK_LOGIN_PHONE` (default `09120000000`) and automatically submits the simulator code (`OTP_DEV_FALLBACK_CODE`, default `123456`) to the regular verification endpoint. New accounts still complete the display-name registration once. Other phone numbers retain the normal code-entry flow.

The simulator stores only the OTP's keyed digest. Codes remain single-use, expire after five minutes, and are subject to request and verification limits. `OTP_RESEND_COOLDOWN_SECONDS` controls the server-enforced resend delay (default 60 seconds). Quick login is explicitly restricted to development and the configured phone; the backend still verifies and consumes the challenge before issuing a session. Keep both simulator and quick login disabled outside local development and use an isolated local database; neither fixed value is suitable for shared or production environments. Development-issued challenges cannot be verified if the simulator is disabled or `NODE_ENV` is not `development`.

A server-side SMS.ir Verify adapter is available when `SMSIR_MODE=production` is explicitly selected and its account settings are valid. The current official OpenAPI document does not describe a sandbox endpoint; `SMSIR_MODE=sandbox` therefore makes no external request. The simulator is the local no-SMS development path, not an automatic fallback after provider failure. Production requests fail closed and never return a code. See [SMS.ir setup](./SMSIR_SETUP.md) before configuring a real account. Automated tests mock all provider HTTP requests.

The sample uses a local MongoDB database named `asoudeh`. `AUTH_HASH_SECRET` must be a separate random value of at least 32 bytes. `TEST_MONGODB_URI` is reserved for tests and targets the separate local `asoudeh_test` database. The database test only issues a ping and does not create, update, or delete records. It refuses remote hosts, other database names, and credential-bearing URIs.

## Frontend
Copy `frontend/.env.example` to `frontend/.env.local` only if a local file does not already exist.

`NEXT_PUBLIC_API_URL` is public configuration and must not contain credentials or secrets.

Never print, overwrite, or commit local `.env` files or secret values. All `.env.*` files are ignored by Git except `.env.example` templates.

## Database tests

Provide a local MongoDB server and the dedicated test URI before running:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/asoudeh_test'
npm --prefix backend run test:db
Remove-Item Env:TEST_MONGODB_URI
```

The integration test is skipped by the regular test suite when `TEST_MONGODB_URI` is not set. A configured URI must point to the local `asoudeh_test` database without credentials.
