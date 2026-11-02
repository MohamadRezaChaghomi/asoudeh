# Security model and operational cautions

## Authentication and OTP

- Authentication is passwordless and OTP-based. OTP challenges store a keyed digest, expire after five minutes, and are single-use.
- Phone/IP request limits, resend cooldown, verification-attempt limits, and temporary blocking are enforced server-side.
- The development simulator is opt-in and restricted to `NODE_ENV=development`. Its configured fallback code is entered manually; API responses and browser storage do not expose or retain it. It is not a fallback for provider failure.
- SMS.ir calls are backend-only. API keys and OTPs are not sent to the frontend or written to logs. Provider errors are sanitized, and timeout/network uncertainty does not trigger an automatic retry.
- SMS API acceptance, especially in Sandbox, does not prove message delivery.

## Sessions, cookies, CSRF, and Origin

- Access tokens are short-lived JWTs; refresh credentials are random opaque values stored as hashes and rotated. Reuse detection revokes the token family.
- Access and refresh cookies are `HttpOnly`, host-only, and scoped by path. The CSRF cookie is readable by the browser; its matching token is kept in memory and sent in `X-CSRF-Token`.
- Cookie-authenticated state-changing requests require the configured Origin and CSRF cookie/header pair. CORS is restricted to the configured client origin.
- Cookies are `Secure` only when `NODE_ENV=production`; production deployment must explicitly set that environment value and use same-site HTTPS frontend/API origins. A deployment that omits or misconfigures `NODE_ENV` is not production-safe. The current environment does not establish whether any live deployment is misconfigured.
- Sessions have both an absolute lifetime and a ten-minute inactivity deadline. Only trusted user activity renews the idle deadline.

## Authorization and data isolation

- Controllers/services derive ownership from the authenticated session. Request IDs are not treated as authorization.
- Financial data is owner-scoped. Caregiver views require an accepted, active relationship and the specific read permission; no caregiver write endpoints are implemented.
- Account deletion revokes access immediately and schedules a delayed purge. Production worker health, index rollout, and cross-collection failure recovery still require operational verification.

## Validation, errors, and logging

- Request bodies and parameters are validated with Zod.
- Central error handling returns a public error shape instead of stack traces or raw provider responses. Logs should not contain request bodies, OTP values, API keys, refresh tokens, or raw provider payloads.
- Search terms are treated literally and bounded; assistant output is rendered as plain text, not HTML.
- The assistant endpoint is authenticated, Origin/CSRF-protected for writes, and rate-limited per user. It sends only the question and selected public guide text to the configured provider, not personal financial records. The provider may retain the transmitted text under its own terms; review those terms before enabling the feature.

## Secrets and configuration

- Keep credentials in ignored backend environment files or the deployment secret manager. Never place secrets in `NEXT_PUBLIC_*`, frontend code, tests, Git, screenshots, logs, or documentation.
- `AUTH_HASH_SECRET` must be a separate random value of at least 32 bytes. `JWT_SECRET` is required by configuration; its actual production value/entropy was not inspected or verified in this audit. Use a high-entropy secret and rotate it only with an explicit session invalidation plan.
- Configure SMS and assistant keys only on the backend. Leave optional providers unset when not approved/configured.
- The repository does not establish production TLS, WAF, backup/restore, monitoring, dependency scanning automation, or incident-response operations.

## Review scope and remaining assurance

Source and test review found owner-scoped queries, session controls, request validation, and sanitized provider errors; automated auth, access-control, provider-mock, and feature tests passed in the documented local environment. This is not a penetration test, formal security certification, or proof of zero vulnerabilities. Production configuration, browser/device behavior, restore drills, and third-party data-retention controls remain unverified.
