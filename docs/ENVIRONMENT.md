# Environment

Use Node.js `22.14.0` or newer. The repository pins `22.14.0` in `.nvmrc`.

## Backend
Copy `backend/.env.example` to `backend/.env` only if a local file does not already exist. Configure separate random values for `JWT_SECRET` and `AUTH_HASH_SECRET`; never commit the resulting `.env`.

For local development without SMS, set `OTP_DEV_SIMULATOR_ENABLED=true` while `NODE_ENV=development`. The simulator uses the configured `OTP_DEV_FALLBACK_CODE` (default `123456`), which must be entered manually. The API does not return the code, the browser does not store it, and there is no quick-login bypass. New accounts still complete the display-name registration once.

The backend requires `NODE_ENV` to be explicitly set to `development`, `test`, or `production`; it will not start with an unset or unsupported value. In production, `JWT_SECRET` and `AUTH_HASH_SECRET` must each be at least 32 UTF-8 bytes and must differ; `CLIENT_URL` must use HTTPS; and the OTP simulator must be disabled. Production authentication cookies are marked `Secure`.

Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse-proxy hops in front of the backend (default `1`). Restrict direct access to the backend so untrusted clients cannot supply forwarded-IP headers; rate limits use Express's resolved client IP and store only keyed hashes of phone/IP identifiers.

The simulator stores only the OTP's keyed digest. Codes remain single-use, expire after five minutes, and are subject to request and verification limits. `OTP_RESEND_COOLDOWN_SECONDS` controls the server-enforced resend delay (default 60 seconds). Keep the simulator disabled outside local development and use an isolated local database; the fixed development code is unsuitable for shared or production environments. Development-issued challenges cannot be verified if the simulator is disabled or `NODE_ENV` is not `development`.

A server-side SMS.ir Verify adapter uses `SMSIR_API_KEY` and `SMSIR_VERIFY_TEMPLATE_ID` (default `123456`) when the development simulator is disabled. `SMSIR_MODE=sandbox` and `SMSIR_MODE=production` both call the fixed Verify endpoint; use the corresponding credentials configured in the SMS.ir panel. A successful provider response is not proof of handset delivery. The simulator is the local no-SMS development path, not an automatic fallback after provider failure. Requests fail closed and never return a code. Automated tests mock provider HTTP requests; the separate Sandbox connection test requires explicit opt-in. See [SMS.ir setup](./SMSIR_SETUP.md).

The optional guide assistant uses `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL` only in the backend. Leave them unset to keep the assistant unavailable. If configured, the provider receives the user's question and selected public guide content, not account or financial records. Review the provider's retention/privacy terms before enabling it.

The sample uses a local MongoDB database named `asoudeh`. Use separate random values of at least 32 bytes for both production authentication secrets. `TEST_MONGODB_URI` is reserved for tests and targets the separate local `asoudeh_test` database. The database test only issues a ping and does not create, update, or delete records. It refuses remote hosts, other database names, and credential-bearing URIs.

For production frontend builds, set `NEXT_PUBLIC_API_URL` to the HTTPS API URL. The frontend emits a Content Security Policy and standard security headers; its CSP permits connections only to the configured API origin.

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
