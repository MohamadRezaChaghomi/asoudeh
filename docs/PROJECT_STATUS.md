# Project status snapshot

**Snapshot date:** 2026-11-02  
**Branch:** `main`  
**Git state at start of this audit:** existing local changes were present and preserved. No commit or push was made.

Status meanings: **Complete** means implementation and relevant local tests exist; it does not mean production certification. **Implemented but needs testing** means behavior exists but adequate automated/runtime evidence is missing. **Partially implemented** means a meaningful subset exists with a documented boundary. **Not implemented** means no current feature. **Blocked** means external configuration or a safety/product decision prevents completion.

| Capability | Implementation status | Test status | Security status | Remaining work / next priority |
|---|---|---|---|---|
| OTP login and registration | Partially implemented | Backend API tests and Edge E2E pass; live provider delivery not tested | OTP digest, expiry, attempt/request limits, and CSRF/session controls are covered locally | **P0:** obtain approved SMS credentials/template and authorize a controlled test; production delivery remains blocked |
| Session, refresh, logout, idle expiry | Complete | Backend auth API and browser flows pass | Rotation/reuse detection, Origin/CSRF, cookie/session checks are implemented | **P1:** validate production cookie/origin settings and multi-tab/network behavior |
| Profile and accessibility preferences | Complete | Backend profile tests and Edge settings/preferences tests pass | Profile mutations are authenticated, owner-scoped, and CSRF/Origin protected | **P2:** measure contrast, screen-reader, and zoom behavior on target devices |
| OTP-confirmed account deletion | Partially implemented | Backend API and browser scheduling flows pass | Request requires the account's OTP; access is revoked immediately and purge is delayed | **P1:** production worker monitoring/index rollout and retention policy remain; cancellation is not implemented |
| Transactions and dashboard balance | Complete | Backend API and browser workflows pass | Owner-scoped APIs and cross-owner tests exist | **P1:** broaden boundary tests and monitor real persisted-data performance |
| Categories | Partially implemented | Backend API tests exist; no dedicated frontend category E2E suite | Owner/system category boundaries are enforced in backend | **P1:** safe physical deletion is intentionally disabled pending concurrency-safe reassignment and an agreed income fallback |
| Budgets | Complete | Backend API and browser tests pass, including exact threshold regression | Owner-scoped API and category restrictions are tested | **P2:** continue edge-case testing at month boundaries and with legacy data |
| Reports and financial aggregation | Complete | Backend API and browser tests pass | Owner-scoped aggregation is implemented | **P2:** validate against representative production-like fixtures and monitor query cost |
| Reminders and monthly completion | Partially implemented | Backend date/API and browser tests pass | Owner scope and idempotent completion are tested | **P1:** external reminders/notifications are not implemented |
| Caregiver read-only access | Complete | Backend API and Edge invitation/acceptance/revoke flows pass | Explicit permission checks, owner checks, revocation, and audit events exist | **P1:** invitation delivery remains out-of-band; validate production indexes and operations |
| Public pages and responsive RTL UI | Complete | Edge route, public-page, responsive, and theme tests pass | No high-impact issue confirmed by current source/test review | **P2:** perform representative accessibility and usability evaluation |
| PWA offline shell | Partially implemented | Production Edge PWA path passes | Cache is restricted to generic public offline content; no account/API cache | **P2:** installation/device behavior not tested; no offline write/sync |
| Guide assistant | Partially implemented | Backend assistant tests and frontend mocked E2E pass | Authenticated, rate-limited; question and selected public guide content only; no conversation persistence in Asoudeh | **P1:** provider is optional and unverified; review provider retention/terms before enabling |
| Browser text-to-speech | Partially implemented | Browser APIs are mocked in tests | User-initiated visible-text reading; real system voice/runtime not tested | **P2:** test with target devices and screen readers; voice input is not implemented |
| SMS.ir Sandbox and production delivery | Blocked | Unit/auth tests use mocked HTTP; opt-in connection test exists but was not run | Backend-only API key; sanitized failures; no automatic timeout retry | **P0:** configure credentials and template, then run only an explicitly authorized Sandbox check |
| Backup, restore, monitoring, deployment | Not implemented | No deployment/restore evidence | Production configuration and operational controls are not verified | **P0:** define staging deployment, backups/restore, index rollout, worker monitoring, and incident response |
| OCR, voice input, exports, notification delivery | Not implemented | No tests | Requires separate product/privacy design | **P3:** do not add before MVP stability and explicit requirements |

## Verified checks

Current audit results and safe commands are recorded in [TESTING.md](./TESTING.md). The principal current counts are backend **116 passed / 1 skipped**, frontend Edge **37 passed / 1 skipped**, and Jalali utility **4 passed**. Builds, lint, and typecheck passed. The SMS Sandbox network test was not run.

## Confirmed documentation and quality findings

- Several existing documents still described an OTP disclosure/quick-login behavior that has since been removed. The README, API, environment, and decision documentation were corrected to match current manual OTP entry and non-disclosure.
- The project is not production-ready: live SMS, deployment, production index rollout, backups/restores, and accessibility/usability outcomes remain unverified.
- Source review identified configuration-dependent safeguards that require explicit production settings: `NODE_ENV=production` is needed for `Secure` cookies, and `JWT_SECRET` strength is not enforced by code. No actual deployment values were read, so these are configuration/assurance risks, not confirmed exposed secrets or an observed live vulnerability.
- No confirmed application security exploit was established by this source/test audit. This is not a penetration test or a claim that the project has no vulnerabilities.

## Suggested release gates

1. Configure and verify production OTP delivery with a controlled authorized test; keep real secrets in the deployment secret manager.
2. Deploy to staging with TLS, `NODE_ENV=production`, reviewed cookie/CORS origins, required indexes, and alerts for account-deletion worker failures.
3. Exercise backup and restore, session expiration/revocation, and owner-isolation scenarios against non-production data.
4. Resolve category deletion semantics before enabling destructive category operations.
5. Complete keyboard, screen-reader, zoom, contrast, and representative-user evaluation; record measured outcomes rather than estimated percentages.
