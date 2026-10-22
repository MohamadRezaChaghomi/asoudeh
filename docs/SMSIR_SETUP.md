# SMS.ir OTP setup

## Existing authentication flow

The project already has one OTP authentication flow: `POST /api/v1/auth/otp/request` creates a MongoDB challenge, and `POST /api/v1/auth/otp/verify` consumes it before existing login or registration logic creates a session. OTPs are generated with Node's cryptographic `randomInt`, stored only as a keyed digest, expire after five minutes, and are single-use. Phone/IP request limits, resend cooldown, failed-attempt tracking, and temporary blocking remain in place.

The SMS.ir adapter is server-side and uses the existing Verify endpoint; it does not create a second authentication route. In the local simulator mode, the development OTP remains fixed/configurable and is disclosed only in development. In SMS.ir mode, a cryptographically generated code is sent to SMS.ir and is never returned to the browser or logged.

## Official API details verified

The official SMS.ir OpenAPI document at <https://api.sms.ir/swagger/v1/swagger.json> currently documents:

- `POST https://api.sms.ir/v1/send/verify`
- API-key authentication via the `x-api-key` request header.
- A JSON body with `mobile`, integer `templateId`, and `parameters` containing string `name` and `value` fields.
- A JSON response envelope containing integer `status`, `message`, and `data`; the Verify result schema includes `messageId` and `cost`.

The official OpenAPI schema does not document a sandbox server, status-code meanings, account template IDs, or template variable names. The adapter therefore never sends in `SMSIR_MODE=sandbox`. In explicit production mode it accepts only an HTTP-success response with `status: 1` and a positive `data.messageId`; this means SMS.ir accepted a send request, **not** that the message has reached the handset. Confirm the exact status behavior and template parameter against your SMS.ir panel before authorizing a live request.

The URL is restricted to the official HTTPS host `api.sms.ir` to prevent sending the API key to an untrusted configured endpoint. No automatic retries are made because a timeout can occur after the provider has accepted a paid message.

## Account values and local configuration

In the SMS.ir panel:

1. Create or retrieve an API key and confirm it is active and permitted to use the Verify API.
2. Create or select an approved Verify/OTP template. Obtain its numeric template ID.
3. Find the exact parameter name expected by that template, including its case. Do not infer it from the visible template text.
4. Confirm your account's balance/credit and any required sender, template, or service activation.
5. Ask SMS.ir support/panel documentation whether your account has a real sandbox. The public OpenAPI document currently exposes only `https://api.sms.ir`, so this project does not treat `sandbox` as a no-cost or non-delivery environment.

Put account values only in the ignored local `backend/.env` file. Never put them in frontend environment files, source code, or `NEXT_PUBLIC_*` variables:

```dotenv
SMSIR_API_KEY=
SMSIR_TEMPLATE_ID=
SMSIR_BASE_URL=https://api.sms.ir/v1
SMSIR_MODE=sandbox
SMSIR_OTP_PARAMETER_NAME=
```

Leave mode as `sandbox` while testing without sending messages. For a live, potentially paid send, explicitly change `SMSIR_MODE=production`. Production mode requires the key, approved numeric template ID, and exact parameter name. Keep `OTP_DEV_SIMULATOR_ENABLED=false` and `OTP_DEV_QUICK_LOGIN_ENABLED=false` for a real SMS test. The fixed quick-login number is a development convenience only and does not receive special treatment in production.

Restart the backend after changing environment settings. Do not copy or paste the API key into chat. The server validates configuration on a send attempt and returns a non-sensitive error if required settings are absent or invalid.

## Development and tests

For local UI/API exploration without SMS, keep:

```dotenv
NODE_ENV=development
OTP_DEV_SIMULATOR_ENABLED=true
OTP_DEV_QUICK_LOGIN_ENABLED=true
OTP_DEV_QUICK_LOGIN_PHONE=09120000000
SMSIR_MODE=sandbox
```

The quick-login flow submits the development simulator code through the regular backend verification endpoint. It does not directly create a session. New accounts still need a display name. Other phone numbers use the normal code-entry route.

Automated adapter and authentication tests mock the native `fetch` call and do not send SMS or use an SMS.ir credential. Run from the repository root:

```powershell
npm --prefix backend test -- src/tests/smsIrProvider.unit.test.ts
npm --prefix backend test -- src/tests/auth.api.test.ts
npm run lint
npm run typecheck
npm run build:backend
npm run build:frontend
```

The database-backed authentication tests are skipped unless both MongoDB URI variables target the isolated local `asoudeh_test` database. Never point test variables at a shared or production database.

## One explicitly authorized live test

Do not run this until the account values above are present locally and you explicitly authorize a paid request to your own mobile:

1. Configure the five `SMSIR_*` variables in `backend/.env`; confirm the approved template and parameter name.
2. Set `SMSIR_MODE=production`, `OTP_DEV_SIMULATOR_ENABLED=false`, and `OTP_DEV_QUICK_LOGIN_ENABLED=false`.
3. Confirm that the browser login form contains your own Iranian mobile number.
4. Start the backend and frontend. Submit exactly one OTP request and observe the non-sensitive API result.
5. Check your phone, enter the received code, and confirm the existing login/registration route works.
6. Confirm that a second verification attempt with the same code fails.
7. Check the SMS.ir panel's message report separately if you need delivery confirmation. A successful Verify API response alone indicates provider acceptance, not handset delivery.

This repository has not sent or verified a real SMS. Do not place API keys or OTPs in screenshots, logs, bug reports, or chat.

## Troubleshooting

| Diagnostic | Meaning and next step |
| --- | --- |
| `SMSIR_MODE=sandbox` / no delivery | No sandbox endpoint is documented in the current official OpenAPI. Keep the development simulator enabled for local work, or explicitly authorize production mode only after confirming the SMS.ir account setup. |
| `SMSIR_CONFIGURATION_ERROR` | Check that the API key is present, template ID is a positive integer, parameter name is set exactly as approved, and base URL is the official HTTPS API URL. Never share the key while troubleshooting. |
| `OTP_DELIVERY_UNAVAILABLE` | Check the server's sanitized category/status log, SMS.ir service status, key permissions, template approval, and account credit. Raw provider responses are deliberately not exposed to the client. |
| HTTP 401/403 | Check whether the key is active and has permission for this API/template. |
| HTTP 402 or provider rejection | Check account credit, template activation/approval, phone format, and any panel-side restrictions. The public API does not expose provider details to the client. |
| HTTP 429 | Respect the provider and application rate limits; wait before requesting another code. |
| Timeout or network error | Delivery may be uncertain. The adapter does not automatically retry; check the provider report before manually requesting another potentially billable message. |
| Request accepted but no SMS arrives | Check SMS.ir delivery reports and account/template/sender status. Provider acceptance is not proof of handset delivery. |

