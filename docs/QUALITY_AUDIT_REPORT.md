# Asoudeh Quality Audit Report

Audit date: 2026-10-22  
Repository: `MohamadRezaChaghomi/asoudeh`  
Branch: `main`  
Baseline: `HEAD` and `origin/main` both `120f2a2`; no staged changes.

## A. Overall status

**PASS WITH LIMITATIONS.**

Core backend tests, frontend/browser workflows, static checks and production builds passed after three confirmed application defects were corrected. Production SMS, deployment/operations, full accessibility conformance, real-user outcomes and frontend development-tool advisories remain outstanding. This report is evidence about the local checkout, not a production certification.

## B. Scope and baseline

Reviewed source/configuration/documentation includes:

- Root/frontend/backend manifests and lockfiles, Node/npm versions, routes, Next app/components/client, Express routes/controllers/services/models/middleware/validators/configuration, and test configurations.
- Existing route and API contract documentation, project report, handover/status, roadmap, decisions, development/environment/SMS setup documents, and original product specification requirements.
- Frontend public logo/PWA assets, manifest, service worker, responsive shell, authentication, financial workflows, and tests.
- Independent read-only security review plus separate frontend and backend functional code reviews.

Environment observed: Node `v22.14.0`, npm `10.9.2`, Next `15.5.28`, React `19.3.1`; Express/Mongoose with MongoDB persistence. npm is the package manager. There is no checked-in `.github/workflows` CI configuration. Local `.env` values were not manually inspected, printed, or modified; Next reported loading `.env.local`, and backend configuration uses dotenv. The backend test process explicitly overrode its database URI and test secrets. Backend automated integration tests were pointed at `mongodb://127.0.0.1:27017/asoudeh_test`, using synthetic fixtures; cleanup is scoped to generated test IDs/phones. No production/shared database, real SMS, financial transfer, or live user data was used.

The baseline worktree already had 18 tracked modifications and two new UI components from the preceding logo/skeleton milestone. Those changes were preserved. This audit added fixes/tests and these two audit documents; nothing was staged, committed, or pushed.

## C. Findings and corrective actions

### Critical

None identified.

### High

- **Frontend development dependency audit — unresolved.** `npm audit` reports **7 high** advisories in the complete frontend dependency tree. Reported paths include `braces` via Tailwind's `chokidar`/`micromatch` chain and `fast-glob` under `eslint-config-next`. These are development/build tooling paths; the frontend production-only audit reports zero. The installed Tailwind 3 line is already at `3.4.19`; `npm audit fix --dry-run` still proposes a breaking Tailwind 4 upgrade for full remediation. No major framework/styling migration or compatibility-breaking override was made without a migration/test plan.

### Medium

- **Budget status used the rounded display percentage.** Spending 24,990 against a 25,000 limit rounds to 100%, although 10 remains. The old status could therefore report `exceeded` before the exact limit was reached. Fixed status selection to compare exact integer amounts and added a backend API regression asserting 24,990 spent, 10 remaining, displayed 100%, and `warning`.
- **Budget requests skipped shared session refresh retry.** The frontend API client's refreshable-request allowlist omitted `/budgets`, causing a recoverable 401 to be treated as a sign-in failure. Added budgets to the allowlist and a browser regression that verifies one refresh and a successful retried load.
- **Frontend development dependency audit — unresolved moderate advisories.** `npm audit` reports **2 moderate** advisories, including `postcss-selector-parser <7.1.6` through Tailwind's `postcss-nested` chain. They are absent from the production dependency audit; safe remediation requires a tested compatible-toolchain migration/override.

### Low

- **Mobile page-reader control was visually blank.** Its only text was clipped by the mobile `.theme-toggle span` rule. Added state-specific `Volume2`/`VolumeX` visible icons while keeping the Persian accessible label; the shell browser test now checks the icon at 390px.

### Informational

- The horizontal 3:2 wordmark and square PWA icon are intentionally different assets: `logo.svg` is the UI wordmark; `asoudeh.svg` has a 512×512 viewBox for installed-app contexts. The production PWA test verifies the manifest/worker asset behavior. Do not replace the square icon with the horizontal wordmark.
- The supplied PNG is 1536×1024 and contains pale lettering that is poorly legible on light surfaces. The UI uses the supplied SVG wordmark instead. Browser runtime measured the SVG at intrinsic 800×533 and rendered 128×85.3 with its ratio preserved; the SVG inspection found no script, embedded image, or external references.
- The independent security-review agent reported **no vulnerability findings in the code it reviewed**. This is not a penetration test, compliance certification, or claim of zero security risk.

## D. Validation evidence

Commands below were executed against the final code changes unless noted.

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — backend and frontend TypeScript checks passed after fixes. |
| `npm run lint` | **PASS** — backend and frontend ESLint passed after fixes. |
| `npm run test:backend` | **PASS** — 16 test files, 113 tests passed; included API tests against the explicit local isolated `asoudeh_test` database. |
| `npm --prefix frontend run test:jalali` | **PASS** — 3 passed, 0 failed. Node emitted its experimental type-stripping/module-type warnings. |
| `Set-Location frontend; npx playwright test --workers=1` | **PASS WITH SKIP** — 31 passed, 1 skipped. The skipped test is production-only PWA coverage, intentionally excluded in dev mode. |
| `PWA_TEST=true; npx playwright test tests/pwa.spec.ts --workers=1` | **PASS WITH SKIP** — production PWA test passed (manifest, service worker/offline shell and cache boundary); the dev-only service-worker test was skipped by design. |
| `npm run build:backend` | **PASS** — production TypeScript build completed. |
| `npm run build:frontend` | **PASS** — optimized Next.js production build completed and generated the application routes. |
| `npm audit --prefix backend --audit-level=low` | **PASS** — 0 vulnerabilities across backend dependency tree. |
| `npm audit --prefix backend --omit=dev --audit-level=low` | **PASS** — 0 backend production vulnerabilities. |
| `npm audit --prefix frontend --omit=dev --audit-level=low` | **PASS** — 0 frontend production vulnerabilities. |
| `npm audit --prefix frontend --audit-level=low` | **LIMITATION** — 9 development-tree advisories (7 high, 2 moderate); see findings. |
| `npm audit fix --dry-run --prefix frontend` | **NO CHANGE** — dry run still reported the 9 advisories and proposed Tailwind 4 as the breaking remedy; no package or lockfile was changed. |
| `git diff --check` | **PASS** — no whitespace errors; Git emitted existing CRLF-to-LF notices for modified files. |

### Browser/runtime evidence

- The serial Edge development suite passed after an initial high-parallelism attempt (10 workers) experienced 9 timeouts/navigation failures under local server contention. The corrected serial run passed; this was an execution-capacity issue, not retained application failures.
- Production PWA testing initially could not start after the development Playwright server replaced `.next`; rebuilding the production frontend and rerunning the production-only test passed.
- Production `/login` loaded in Edge; the supplied SVG logo was visible, kept its 3:2 aspect ratio, and the login screenshot showed no duplicated brand label. The page smoke recorded **0 console errors, 0 page errors, and 0 failed requests**.
- The integrated VS Code browser reported its own preload-script error when opening standalone raw SVG assets. The login-page browser smoke did not report that error; it is a browser-harness message, not an application request/console error.
- Browser feature tests use mocked API responses; backend API integration tests separately exercise real Express/Mongoose behavior on the isolated local test database. No combined browser-to-live-backend OTP/SMS smoke was run during this audit.

### Non-passing invocation notes

- `npm run test:e2e` from repository root failed because there is no root E2E script. The supported script is frontend-local.
- An initial frontend invocation did not apply the requested worker limit and ran 10 workers; 9 browser tests timed out. The direct frontend CLI with `--workers=1` passed all applicable tests.
- The production PWA test was first attempted after development mode had replaced the production `.next` build; rebuilding then rerunning passed.

## E. Outstanding work and residual risks

1. Configure an approved SMS.ir Verify key/template and obtain explicit authorization for a live, potentially paid test before production authentication.
2. Plan a tested frontend tooling migration to remove the 9 development-only advisories; production dependency audits are currently clear.
3. Measure WCAG 2.2 AA (including contrast), keyboard/screen-reader/200% zoom/mobile touch behavior, and user task success with representative older adults. Current automated tests do not establish usability metrics or certification.
4. Deploy to a non-production environment and verify HTTPS cookie/origin settings, MongoDB topology/indices, backups, account-deletion worker health/retention, logging, and operational recovery.
5. Keep category deletion disabled until transaction reassignment has concurrency-safe guarantees and income/expense fallback behavior is approved.
6. External reminder and caregiver-invitation delivery, offline transaction submission/sync, OCR, voice input and chatbot remain unsupported/out of current scope; do not represent them as implemented.
7. The app-wide UI/API error, empty, pending and boundary combinations are not exhaustively browser-tested. Existing feature pages, especially transactions and reminders, remain large; only refactor when a bounded feature change justifies it.
8. No cross-browser Safari/Firefox certification or performance budget measurement was performed.

## F. Git and artifacts

- Final branch remains `main`, still at `120f2a2` and aligned with `origin/main`; no commit or push occurred.
- Worktree contains the pre-existing logo/skeleton milestone modifications plus this audit's budget status/client retry/mobile control fixes, regression tests and audit documents. There are no staged changes.
- No dependency manifests/lockfiles were changed. Local `.env` files were not manually inspected or modified; no secret values were printed.
- Playwright generated `frontend/test-results/.last-run.json`; that exact metadata file was removed after the final run.

For requirement-level detail, see [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md). For current product boundaries and API behavior, see [PROJECT_REPORT.md](./PROJECT_REPORT.md), [API.md](./API.md), and [ROADMAP.md](./ROADMAP.md).
