# Environment

Use Node.js `22.14.0` or newer. The repository pins `22.14.0` in `.nvmrc`.

## Backend
Copy `backend/.env.example` to `backend/.env` only if a local file does not already exist. Configure separate random values for `JWT_SECRET` and `AUTH_HASH_SECRET`; never commit the resulting `.env`.

For local development without SMS, set `OTP_DEV_SIMULATOR_ENABLED=true` while `NODE_ENV=development`. The simulator uses `OTP_DEV_FALLBACK_CODE` (default `123456`), stores only its keyed digest, and returns the code only in the development response so the login UI can display it. The OTP remains single-use, expires after five minutes, and is subject to the existing request and verification limits. Keep the simulator disabled outside local development and use an isolated local database; the fixed fallback is intentionally not suitable for shared or production environments. Development-issued challenges cannot be verified if the simulator is disabled or `NODE_ENV` is not `development`.

A real SMS provider is not part of this checkpoint. This simulator is the local no-SMS development path, not an automatic fallback after a real provider failure. Production OTP requests continue to fail closed and never return a code. API tests enable the simulator only inside their isolated test process.

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
