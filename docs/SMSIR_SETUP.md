# SMS.ir OTP setup

## Existing authentication flow

The project has one OTP flow: `POST /api/v1/auth/otp/request` creates a MongoDB challenge and `POST /api/v1/auth/otp/verify` consumes it before login or registration. SMS.ir uses the existing cryptographically generated six-digit code. OTP values are stored only as keyed digests, expire after five minutes, and remain single-use. Existing phone/IP limits, resend cooldown, failed-attempt tracking, and temporary blocking are preserved.

The development simulator remains available only when `NODE_ENV=development` and `OTP_DEV_SIMULATOR_ENABLED=true`. It does not call SMS.ir. When the simulator is disabled, the backend sends the OTP using the Verify API and never returns or logs the code.

## Verify request and response

The backend sends `POST https://api.sms.ir/v1/send/verify` with:

- `Content-Type: application/json`
- `Accept: text/plain`
- `x-api-key: <SMSIR_API_KEY>`

The JSON body has the form below; in the real request the mobile comes from the login request and the value is the generated six-digit OTP:

```json
{
  "mobile": "09121234567",
  "templateId": 123456,
  "parameters": [{ "name": "Code", "value": "012345" }]
}
```

`SMSIR_VERIFY_TEMPLATE_ID` supplies the positive integer template ID and defaults to `123456`. The parameter name is fixed as `Code`. The endpoint is fixed to SMS.ir's HTTPS API host.

HTTP success alone is not treated as provider success. The response body must be valid JSON and contain `status: 1` and a positive `data.messageId`; `cost` is also returned by the adapter when numeric. SMS.ir may return JSON with a `text/plain` content type. A positive response means provider acceptance, **not** delivery to a handset. A passing Sandbox request must not be interpreted as proof that an SMS was sent or received.

Both `SMSIR_MODE=sandbox` and `SMSIR_MODE=production` use the configured Verify endpoint and request shape. Choose the appropriate credentials and template settings from the SMS.ir panel. A timeout can happen after the request was processed, so the adapter does not retry automatically. HTTP errors, API-key authentication failures, malformed responses, provider rejection, timeouts, and network failures are surfaced using sanitized application errors. API keys, OTPs, and raw provider response bodies are never sent to the client or written to logs.

## Backend environment

Keep account credentials only in the ignored local `backend/.env` file. Do not overwrite an existing `.env`; edit its relevant settings locally. The API key must be obtained from your SMS.ir panel and has not been supplied in the repository:

```dotenv
SMSIR_MODE=sandbox
SMSIR_API_KEY=YOUR_SANDBOX_API_KEY
SMSIR_VERIFY_TEMPLATE_ID=123456
```

For local development without provider requests, set `OTP_DEV_SIMULATOR_ENABLED=true` while `NODE_ENV=development`; the simulator takes precedence. To exercise SMS.ir through the application, set `OTP_DEV_SIMULATOR_ENABLED=false`, use your Sandbox account values, and restart the backend. Do not put credentials in frontend environment files, source code, tests, Git, screenshots, logs, or chat.

## Automated tests

Unit and authentication tests mock `fetch`; they assert request method, endpoint, headers, body, successful response validation, errors, and preservation of the OTP auth flow. These tests do **not** make HTTP requests to SMS.ir and do not send SMS. Run from the repository root:

```powershell
npm --prefix backend test -- src/tests/smsIrProvider.unit.test.ts
npm --prefix backend test -- src/tests/auth.api.test.ts
npm run lint:backend
npm run typecheck:backend
npm run build:backend
```

The database-backed auth tests are skipped unless the test database environment targets the isolated local `asoudeh_test` database. Never point tests at a shared or production database.

## Explicit Sandbox connection test

This separate opt-in test makes one real HTTP request to SMS.ir. It uses a randomly generated six-digit test value and your configured Verify template. It does not exercise OTP storage or login; the mocked auth tests cover that flow. Confirm Sandbox credentials and use a mobile number you control:

```powershell
$env:SMSIR_SANDBOX_TEST_ENABLED = 'true'
$env:SMSIR_SANDBOX_TEST_MOBILE = '09121234567'
npm --prefix backend run test:smsir:sandbox
Remove-Item Env:SMSIR_SANDBOX_TEST_ENABLED
Remove-Item Env:SMSIR_SANDBOX_TEST_MOBILE
```

Without `SMSIR_SANDBOX_TEST_ENABLED=true`, the test is skipped and makes no network request. A successful response verifies only API acceptance; Sandbox may not deliver a real message. Never run this test with production credentials or for a number you do not control. Regular `npm test` and automated unit tests never send SMS.

## Start the application in PowerShell

From the repository root, start the backend and frontend in separate PowerShell terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

For an in-app Sandbox request, configure the local backend environment, set `OTP_DEV_SIMULATOR_ENABLED=false`, restart the backend, then request an OTP from the login screen using your own mobile number. Check the sanitized API result; do not assume successful Sandbox acceptance means a message reached the phone. For no-SMS local UI testing, keep the simulator enabled.

## Troubleshooting

| Diagnostic | Meaning and next step |
| --- | --- |
| No SMS.ir request from the login flow | Check whether the development simulator is enabled; it takes precedence over the SMS.ir adapter. |
| `SMSIR_CONFIGURATION_ERROR` | Check `SMSIR_API_KEY` and that `SMSIR_VERIFY_TEMPLATE_ID` is a positive integer. Never share the key while troubleshooting. |
| `OTP_DELIVERY_UNAVAILABLE` | Check the sanitized category/status log, SMS.ir service status, key permissions, template activation, and account settings. Raw provider responses are not exposed. |
| HTTP 401/403 | Check whether the key is active and has permission for this API/template. |
| HTTP 429 | Respect provider and application rate limits; wait before requesting another code. |
| Timeout or network error | The outcome may be uncertain. There is no automatic retry; check the provider report before manually requesting another code. |
| Request accepted but no SMS arrives | Check SMS.ir reports and account/template status. API acceptance is not proof of handset delivery. |
