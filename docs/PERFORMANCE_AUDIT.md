# Performance audit

Audit date: 2026-11-04
Repository: `MohamadRezaChaghomi/asoudeh`
Branch: `main`
Base commit: `648500e` (`origin/main` at audit start)
Environment: Windows, Node.js `22.14.0`, npm `10.9.2`, Next.js `15.5.28`, React `19.3.1`.

## Executive summary

The measured production build identified the reports route as a frontend bundle outlier: its initial JavaScript was 238 kB, compared with 103 kB shared by all routes. Recharts was imported directly by that route, so the complete charting dependency was included in its initial bundle. The chart is now loaded on demand, when its reserved layout area approaches the viewport. The production build reports 136 kB First Load JS for reports, a measured reduction of 102 kB (42.9%) without changing the report data or chart behavior.

The authenticated layout also fetched the accessibility profile on every dashboard route change. It now fetches that profile once while the dashboard layout remains mounted, and allows a later route to retry after a failed request. A browser regression verifies that navigating from budgets to categories makes only one profile request.

No evidence justified changing backend queries, MongoDB indexes, authentication, or private-data caching. The existing worker caches only the generic offline page and its icon. Those boundaries were preserved.

## Repository and baseline state

- `main` was at `648500e`, matching `origin/main`; no branch divergence was observed.
- Before implementation, the worktree contained a pre-existing deletion of a Persian-named specification DOCX and an untracked `docs/SPECIFICATION.docx`. They were not changed or included in this audit.
- No `.env` file was read, printed, or modified. No SMS was sent.
- Initial baseline checks: typecheck, lint, backend build, frontend build, and the four Jalali utility tests passed. The first backend test attempt lacked the required explicit local test URI and failed the API suites' safety guard; that run is not counted as a valid test result.
- The frontend production baseline build reported `reports` at **106 kB route size / 238 kB First Load JS**, with **103 kB** shared by all routes.

## Bottlenecks and changes

| Finding | Evidence | Change |
|---|---|---|
| Reports eagerly bundled Recharts. | The baseline production build reported 238 kB First Load JS for `/reports`, versus 135–140 kB for other authenticated routes. | Moved the chart to `frontend/components/reports/ExpenseCategoryChart.tsx`; `DeferredExpenseCategoryChart` imports it only when its reserved chart area intersects the viewport (with a 200 px lead). The route retains a fixed-height placeholder to avoid layout shift and reports a load error while keeping the textual category breakdown available. |
| Dashboard layout repeated its accessibility profile request on route changes. | The `/me` effect depended on `pathname` and had no data reuse; each eligible route transition invoked it again. | `frontend/app/(dashboard)/layout.tsx` now guards the request for the lifetime of the mounted dashboard layout. It resets that guard after an error so a subsequent route can retry. A browser test navigates between routes and asserts exactly one profile request. |
| Theme is set before hydration from local storage. | The Edge browser test reported a root `<html>` hydration-attribute warning for `data-theme`. | Added `suppressHydrationWarning` to the root HTML element. This suppresses the expected theme-only root attribute mismatch; it does not change theme or application data behavior. |
| No measured backend or MongoDB bottleneck was established. | Services already use parallel reads where applicable, projections, `lean()` for read queries, pagination, and owner-scoped filters. No production-like profiler or representative database workload was available. | No speculative indexes, query rewrites, caching, or authorization changes were made. |

### Files changed

- `frontend/app/(dashboard)/layout.tsx` — reuse accessibility profile fetch across route transitions.
- `frontend/app/(dashboard)/reports/page.tsx` — use deferred chart component.
- `frontend/app/layout.tsx` — suppress the intentional root theme hydration warning.
- `frontend/components/reports/DeferredExpenseCategoryChart.tsx` — viewport-triggered dynamic import and accessible loading/error states.
- `frontend/components/reports/ExpenseCategoryChart.tsx` — isolated Recharts implementation.
- `frontend/tests/app-shell.spec.ts` — regression for profile-request deduplication.
- `frontend/tests/reports-caregiver.spec.ts` — verifies the deferred report chart still renders.
- `docs/PERFORMANCE_AUDIT.md` — this audit.

## Before/after measurements

Production build route-size values below are Next.js build output for the baseline and final source. They are the directly comparable bundle measurements in this audit.

| Metric | Before | After | Result |
|---|---:|---:|---|
| Reports route JavaScript size | 106 kB | 4.9 kB | −101.1 kB (−95.4%) |
| Reports First Load JS | 238 kB | 136 kB | −102 kB (−42.9%) |
| Shared First Load JS | 103 kB | 103 kB | No change |
| Dashboard First Load JS | 135 kB | 135 kB | No change |
| Reports API latency | Not measured | Not measured | No comparable API timing or representative backend fixture |
| Dashboard API latency | Not measured | Not measured | No comparable API timing or representative backend fixture |
| Transactions, budgets, reminders API latency | Not measured | Not measured | No comparable API timing or representative backend fixture |
| Backend startup time | Not measured | Not measured | No controlled cold-start baseline |
| FCP / LCP / INP / CLS baseline | Not measured | Not comparable | No pre-change browser baseline or Lighthouse run |

The chart remains available as a dynamically loaded chunk; the 102 kB reduction is from the route's initial bundle, not removal of Recharts from the product.

### One production-browser observation

A single Edge run against the local production build of the public home page, at a 1280×800 viewport with no network throttling, observed: navigation duration **91 ms**, DOMContentLoaded **69 ms**, load event **91 ms**, FCP **156 ms**, LCP **156 ms**, CLS **0.000**, and **26** browser requests (no API calls). This is a local loopback observation, not a representative user measurement, Lighthouse result, or before/after comparison. INP was not measured. Browser `transferSize` was unavailable for cached script entries, so JavaScript transfer bytes are reported from the build rather than inferred from that run.

## Caching, fonts, assets, and startup

- The service worker was not changed. Its cache remains limited to `/offline.html` and `/icons/asoudeh.svg`; it does not cache authenticated routes, API responses, financial records, session data, OTPs, or caregiver data.
- The inspected CSS uses a system-font fallback stack. No local font files or `@font-face` declarations were found, so no font download or weight was changed.
- Two large PNGs exist in `frontend/public/icons`, but the source search found no references to their filenames. They were not deleted or converted; unused-file ownership and whether they are intentionally retained should be confirmed before removing user-facing assets.
- Backend startup order and connection management were inspected, but startup duration was not measured. No backend startup refactor was justified.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed (backend and frontend). |
| `npm run lint` | Passed (backend and frontend). |
| `npm --prefix frontend run test:jalali` | Passed, 4 tests. Node printed its existing experimental type-stripping/module-type warnings. |
| Backend suite with both MongoDB URIs set to the credential-free local `asoudeh_test` database and synthetic test-only secrets | Passed, 116 tests; 1 skipped. No SMS request was made. |
| Frontend Edge Playwright suite | Passed, 37 tests; 1 development-only service-worker test skipped by design. |
| Production PWA Playwright test in Edge | Passed; the development-only service-worker test was skipped by design. Manifest and the offline-cache boundary were exercised. |
| `npm run build:backend` | Passed. |
| `npm run build:frontend` | Passed; final route bundle sizes are shown above. |
| `git diff --check` | Passed. Git emitted line-ending notices for existing CRLF files. |
| Initial backend suite without explicit local test URI | Failed its test-database safety guard; rerun with the documented isolated URI passed. |
| Initial Playwright attempt using bundled Chromium | Could not launch because the Playwright Chromium binary was not installed. Rerunning in installed Microsoft Edge passed. |
| First Edge shell-test attempt | Exposed a strict heading selector in the new regression and a pre-existing root theme hydration warning. The selector and root hydration warning were corrected; the complete Edge suite then passed. |

## Status and remaining limitations

| Area | Status |
|---|---|
| Initial performance audit | Completed to the extent supported by available local build/browser evidence; several baselines remain unmeasured. |
| React rendering/request optimization | Completed for the evidenced repeated profile request; a React Profiler session was not available. |
| Next.js initial bundle optimization | Completed for the reports chart; no other route showed a comparable bundle outlier in the production build. |
| Fonts and image assets | Inspected; no change made. |
| Backend/API optimization | Needs production-like workload measurements; no source changes made. |
| MongoDB optimization/index rollout | Needs query profiler and live index inventory; no new indexes or migrations made. |
| Startup time | Not measured. |
| Caching strategy | Existing privacy-preserving service-worker boundary reviewed and retained; no private-data cache introduced. |
| Performance testing | Typecheck, lint, backend tests, browser tests, PWA test, and production builds passed as detailed above. |
| Before/after Web Vitals | Not comparable because no pre-change browser baseline was captured. |
| Documentation | Completed. |
| Git commit/push | Limited to the audited files; pre-existing unrelated user worktree changes are excluded. |

Next useful measurement: run Lighthouse/Web Vitals against a staging build on representative hardware/network and benchmark the dashboard, reports, and transaction APIs against a seeded, non-production MongoDB dataset with query profiling enabled. Review the unreferenced PNG assets with the product owner before deletion.
