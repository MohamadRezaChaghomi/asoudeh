# Security and implementation decisions

## Authentication and profile checkpoint

Recorded: 2026-10-21

### OTP request throttling

- Allow at most 3 OTP requests per normalized mobile number in any rolling 15-minute window.
- Allow at most 10 OTP requests per client IP in any rolling 15-minute window.
- Count requests whether or not the phone number belongs to an existing user.
- Persist counters in MongoDB so limits are shared across backend processes. Store keyed hashes of phone numbers and IP addresses rather than raw rate-limit keys.
- Return the same generic success response for known and unknown numbers. A throttled request returns HTTP 429 with a generic Persian retry message and a `Retry-After` header.

### OTP resend, attempts, and expiry

- OTPs are cryptographically generated six-digit decimal codes, valid for 5 minutes, and stored only as an HMAC-SHA-256 digest using a dedicated server secret.
- Allow at most 5 failed verification attempts. The fifth failure blocks verification and further OTP sends for that phone number for 10 minutes.
- Requesting another code does not clear failed attempts or an active block. A replacement code may be issued only when the phone is not blocked and both request limits permit it; its challenge retains the existing attempt count until its attempt window ends.
- A replacement code invalidates the previous code. Expired challenges cannot be verified.
- Challenges and counters are persisted with expiry indexes; OTP values and request bodies are never logged.
- The simulator may include the OTP in a development-only response field only when `NODE_ENV=development` and `OTP_DEV_SIMULATOR_ENABLED=true`. Otherwise no simulator OTP is returned or logged. The simulator is disabled in every other environment.
- `AUTH_HASH_SECRET` is a dedicated secret of at least 32 bytes used for OTP, refresh-token, and rate-limit HMACs. Authentication endpoints fail closed if it is absent or too short; it is never derived from the JWT signing key. CSRF tokens are random and compared with a constant-time comparison; they do not use this HMAC secret.

### CSRF and Origin validation

- Require the exact configured `CLIENT_URL` origin on all authentication and profile state-changing requests; reject missing, malformed, `null`, or non-matching Origin values.
- For cookie-authenticated state-changing requests, additionally require a random CSRF cookie and an identical `X-CSRF-Token` header. Compare the values without timing-dependent string comparison.
- Issue and rotate the CSRF token alongside successful authentication and refresh. Return it to frontend JavaScript in the authentication response or Origin-checked bootstrap response and keep it in memory; the matching cookie is scoped to the API path. Authentication cookies are `HttpOnly`.
- Apply the same Origin validation to OTP request and verification endpoints, even before the user is authenticated.

### Session and cookie policy

- Access JWT lifetime is 15 minutes. Refresh credentials are opaque, cryptographically random, valid for 30 days, stored only as keyed hashes, rotated on every successful refresh, and revocable by session family.
- Reuse of a rotated refresh credential revokes every session in that token family.
- Protected requests verify that the access token's session exists, is unexpired, unrotated, and not revoked. If session state cannot be read, the request fails closed.
- Use host-only cookies: `asoudeh_access` (`HttpOnly`, `Path=/api/v1`), `asoudeh_refresh` (`HttpOnly`, `Path=/api/v1/auth`), and `asoudeh_csrf` (not `HttpOnly`, `Path=/api/v1`). Do not set a `Domain` attribute.
- Local development uses `SameSite=Lax` and `Secure=false` for HTTP localhost. Production uses `SameSite=Lax` and `Secure=true`; production frontend and API must be same-site HTTPS origins. Cross-site deployment is not supported by this checkpoint.
- Clear cookies using the same path and attributes used to set them. Frontend JavaScript must never persist access or refresh credentials in browser storage.

### Profile validation

- Canonical phone numbers use Iranian mobile format `09` followed by 9 digits. Common `+98`, `0098`, and Persian/Arabic digit input is normalized before validation and storage.
- Display names are trimmed and limited to 1–80 characters. Birth year is optional and, when supplied, must be an Iranian Solar Hijri year from 1300 through the current Solar Hijri year.
- Initial balance is a non-negative safe integer in toman. Accessibility text scale is restricted to 100%, 125%, 150%, or 200%; high contrast is boolean.
