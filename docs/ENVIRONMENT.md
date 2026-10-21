# Environment

Use Node.js `22.14.0` or newer. The repository pins `22.14.0` in `.nvmrc`.

## Backend
Copy `backend/.env.example` to `backend/.env` only if a local file does not already exist. Configure separate random values for `JWT_SECRET` and `AUTH_HASH_SECRET`; never commit the resulting `.env`.

Set `OTP_DEV_SIMULATOR_ENABLED=true` only for local development when `NODE_ENV=development`. It is disabled in production; API tests enable it only inside their isolated test process. A real SMS provider is not part of this checkpoint, so OTP delivery in production returns an explicit unavailable response rather than exposing a code.

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
