# Environment and External Services

## Runtime and local environment

Use Node.js `22.14.0` or newer (the repository pins `22.14.0` in `.nvmrc`) and npm. Run a local MongoDB instance for development. Docker is optional locally; the staging Compose configuration uses a MongoDB replica set.

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local` only when those files do not already exist. Never print, overwrite, commit, or share `.env` values. Keep credentials only in the backend environment or deployment secret manager.

The backend requires `NODE_ENV` to be explicitly `development`, `test`, or `production`. The sample local database is `asoudeh`; tests must use the separate credential-free local `asoudeh_test`.

## Configuration boundaries

| Variable | Use and safety requirement |
|---|---|
| `MONGODB_URI` | Backend connection. Local development uses a local `asoudeh` database; test commands must use local `asoudeh_test`. |
| `JWT_SECRET`, `AUTH_HASH_SECRET` | Separate high-entropy backend secrets. Production requires at least 32 UTF-8 bytes each and rejects identical values. `AUTH_HASH_SECRET` is not derived from the JWT key. |
| `CLIENT_URL` | Exact frontend Origin expected by the backend. Production requires HTTPS. |
| `NEXT_PUBLIC_API_URL` | Public frontend API base URL; never include credentials or secrets. Production builds require HTTPS. |
| `OTP_DEV_SIMULATOR_ENABLED`, `OTP_DEV_FALLBACK_CODE` | Local no-SMS path only, with `NODE_ENV=development`. The fixed development code must not be used with shared or production data. |
| `SMSIR_MODE`, `SMSIR_API_KEY`, `SMSIR_VERIFY_TEMPLATE_ID` | Backend-only SMS.ir Verify configuration. The template ID is a positive integer and defaults to `123456`. |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | Optional backend-only guide assistant. Leave unset to keep the assistant unavailable. |
| `TRUST_PROXY_HOPS` | Exact trusted reverse-proxy count; default `1`. Restrict direct backend access so clients cannot forge forwarded-IP headers. |
| `TEST_MONGODB_URI` | Test-only URI for the credential-free local `asoudeh_test` database. Never point it to a shared or production host. |

In production the OTP simulator must be disabled, `JWT_SECRET` and `AUTH_HASH_SECRET` must be distinct and sufficiently long, and production cookies are `Secure`. The API refuses unsafe database-test targets. See the [testing and performance guide](../04_Academic_and_Quality/Testing_and_Performance.md) before running database-backed tests.

## SMS.ir Verify

The existing OTP flow is `POST /api/v1/auth/otp/request` followed by `POST /api/v1/auth/otp/verify`. The backend generates a cryptographically random six-digit OTP, stores only a keyed digest, and never returns or logs the code. Development simulator mode takes precedence and does not call SMS.ir.

When the simulator is disabled, both `SMSIR_MODE=sandbox` and `SMSIR_MODE=production` use the fixed HTTPS Verify endpoint `https://api.sms.ir/v1/send/verify`. Choose the matching credentials and approved template from the SMS.ir panel. The request uses:

- `POST`, `Content-Type: application/json`, `Accept: text/plain`, and `x-api-key`.
- A JSON body with the normalized mobile number, numeric `templateId`, and a `Code` parameter containing the generated OTP.
- A valid JSON response with `status: 1` and a positive `data.messageId` to count as provider acceptance.

HTTP success alone is not sufficient. Timeouts, network errors, malformed replies, and provider rejections are surfaced as sanitized errors; the adapter does not retry automatically because a timeout may occur after processing. Provider acceptance, particularly in Sandbox, is not proof of handset delivery. The simulator is not an automatic fallback for SMS failures.

Configure credentials only in the ignored backend environment:

```dotenv
SMSIR_MODE=sandbox
SMSIR_API_KEY=YOUR_SANDBOX_API_KEY
SMSIR_VERIFY_TEMPLATE_ID=123456
```

Automated provider tests mock HTTP and do not send SMS:

```powershell
npm --prefix backend test -- src/tests/smsIrProvider.unit.test.ts
npm --prefix backend test -- src/tests/auth.api.test.ts
```

The optional live Sandbox connection test requires explicit opt-in and a number you control:

```powershell
$env:SMSIR_SANDBOX_TEST_ENABLED = 'true'
$env:SMSIR_SANDBOX_TEST_MOBILE = 'a-mobile-number-you-control'
npm --prefix backend run test:smsir:sandbox
Remove-Item Env:SMSIR_SANDBOX_TEST_ENABLED, Env:SMSIR_SANDBOX_TEST_MOBILE
```

Do not use production credentials for this test. A successful response proves provider acceptance only.

## Optional guide assistant

The assistant is configured only on the backend. A configured provider receives the user's question and selected public guide text, not profile, transaction, budget, or caregiver data. The application does not persist conversation history. Review provider retention and privacy terms before enabling it; leave its variables unset when it is not approved.

## Local database tests and seed scripts

Database/API tests need both `MONGODB_URI` and `TEST_MONGODB_URI` set to the credential-free local `asoudeh_test` database. The URI guard refuses remote hosts, other database names, and credential-bearing URIs. The explicit `test:db` check only pings the server.

The system-category seed is a separate development-only operation. It requires `NODE_ENV=development`, a credential-free local `asoudeh_dev` URI, and its explicit confirmation value; it inserts missing system categories only. It never runs automatically at startup.

The demo-user seed is also restricted to development and the credential-free local `asoudeh_dev` database. It additionally requires `OTP_DEV_SIMULATOR_ENABLED=true` and `SEED_TEST_USERS_CONFIRMATION=seed-test-users`. It upserts three reserved `.invalid` email accounts, sample senior finance records, and an active caregiver link; it does not send SMS or delete unrelated records. Authentication remains passwordless and requires the locally configured simulator code. Never use these accounts or the fixed development OTP with shared or production data.

After confirming the backend environment points to the local `asoudeh_dev` database, run from PowerShell:

```powershell
$env:SEED_TEST_USERS_CONFIRMATION = 'seed-test-users'
npm --prefix backend run seed:test-users
Remove-Item Env:SEED_TEST_USERS_CONFIRMATION
```

## Troubleshooting

| Symptom | Check |
|---|---|
| OTP request returns `503 OTP_DELIVERY_UNAVAILABLE` | Verify whether the local simulator is enabled or SMS.ir settings/template are valid. Do not expect the API to reveal the OTP. |
| No SMS.ir request is made | The development simulator takes precedence when enabled. |
| `SMSIR_CONFIGURATION_ERROR` | Check the backend-only API key and positive numeric template ID without sharing their values. |
| Provider accepts but no SMS arrives | Check provider reports, account/template status, and handset delivery separately; acceptance is not delivery proof. |
| Provider times out | Do not automatically retry; inspect provider status before requesting another code. |
| Database tests stop at the guard | Set both database variables to the isolated local `asoudeh_test` URI. Do not weaken the guard or change it to a shared database. |
