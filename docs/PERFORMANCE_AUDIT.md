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

- The service worker cache is limited to `/offline.html` and `/icons/app-icon.svg` (cache `asoudeh-static-shell-v6`); it does not cache authenticated routes, API responses, financial records, session data, OTPs, or caregiver data.
- The app self-hosts Estedad through `next/font/local`; the offline document deliberately uses the system-font stack.
- Brand PNG/ICO outputs are locally generated and dimensions are checked by `frontend/tests/brand-assets.spec.ts`; the original SVG sources remain available alongside those exports.
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
| Backend/API optimization | A local 50k-transaction test fixture was measured on 2026-11-09; results and remaining staging limitation are below. |
| MongoDB optimization/index rollout | The measured local query plans use existing indexes; no new indexes or migrations were justified. |
| Startup time | Not measured. |
| Caching strategy | Existing privacy-preserving service-worker boundary reviewed and retained; no private-data cache introduced. |
| Performance testing | Typecheck, lint, backend tests, browser tests, PWA test, and production builds passed as detailed above. |
| Before/after Web Vitals | Lighthouse navigation-mode LCP/CLS were captured before and after the cache/compression configuration; INP is not emitted without a qualifying interaction. |
| Documentation | Completed. |
| Git commit/push | Limited to the audited files; pre-existing unrelated user worktree changes are excluded. |

Next useful measurement: repeat Lighthouse/Web Vitals against a staging build on representative hardware/network. Review the unreferenced PNG assets with the product owner before deletion.

## Measured performance pass (2026-11-09)

This pass did not repeat the lazy Recharts or profile-fetch deduplication work above. It used a local production frontend build and only the credential-free local `asoudeh_test` database.

### Backend fixture and query measurements

`backend/src/scripts/performanceSeed.ts` replaces only its reserved `performance-seed@asoudeh.invalid` test user and creates 50,000 transactions in batches. `backend/src/scripts/performanceMeasure.ts` authenticates locally, times dashboard, monthly-report, and first-page transaction-list requests (2 warmups + 12 samples), and prints `explain("executionStats")` summaries. Both scripts refuse any URI except local `asoudeh_test`; the measurement script also requires the API URL to be local. No production or remote database was contacted.

| Endpoint / query | Median API time | p95 API time | Explain execution time | Docs / keys examined | Plan |
|---|---:|---:|---:|---:|---|
| Dashboard | 18.1 ms | 23.3 ms | 6 ms | 1,242 / 1,242 | `IXSCAN userId_1_deletedAt_1_date_-1__id_-1` |
| Monthly report | 18.1 ms | 24.0 ms | 5 ms | 966 / 970 | `IXSCAN userId_1_type_1_deletedAt_1_categoryId_1_date_-1` |
| Transaction list page (100 rows) | 24.1 ms | 45.4 ms | 5 ms | 100 / 100 | `IXSCAN userId_1_deletedAt_1_date_-1__id_-1` |
| Transaction-list count | — | — | 18 ms | 0 / 50,001 | `COUNT_SCAN userId_1_deletedAt_1_date_-1__id_-1` |

All measured API p95s and query explain times are below the ~200 ms threshold, so no backend query or index change was made. The count plan scans the matching index keys without fetching transaction documents. The report performs one batched category `$in` lookup rather than an N+1 lookup; transaction reads are paged at a maximum of 100. Service aggregations put owner/deletion/date/type `$match` stages before grouping, and the find queries use selected fields or bounded result sets. Query projections and existing indexes were retained because the measured plans were already selective and fast.

To reproduce from `backend/` with `NODE_ENV=test`, `MONGODB_URI` and `TEST_MONGODB_URI` both set to `mongodb://127.0.0.1:27017/asoudeh_test`, and synthetic test-only secrets:

```powershell
npm run perf:seed
npm run dev
# In another terminal, with the same test-only environment:
npm run perf:measure
```

The seed run inserted 50,000 transactions in 2.8 seconds. The measurement run returned HTTP success for all three endpoints. No SMS or external API calls are made.

### Production frontend measurements and headers

The before build was run before the static-asset header/compression config change; the after build includes it. Lighthouse 12.8.2 ran in mobile navigation mode against the same local production home page with local Chrome and the same machine. Values are one lab run each, not field data.

| Lighthouse metric | Before | After | Notes |
|---|---:|---:|---|
| LCP | 1,963 ms | 1,951 ms | No material change |
| INP | Not reported | Not reported | Navigation-mode Lighthouse ran no qualifying user interaction; a separate after-build Event Timing check produced no entries at the browser’s 16 ms reporting threshold, so no numeric INP is claimed. |
| CLS | 0.000 | 0.000 | No layout shift observed |
| Performance score | 0.99 | 0.99 | Same score |

The after `next build` reported the largest First Load JS route as `/transactions` at **141 kB**, under the 150 kB threshold. No route exceeded the limit, so no route bundle was changed. The relevant brand image already uses `next/image`; no raw `<img>` usage was found in app/components.

| Bundle measurement | Before config change | After config change | Result |
|---|---:|---:|---|
| Largest route First Load JS | 141 kB (`/transactions`) | 141 kB (`/transactions`) | No route exceeded 150 kB |
| Shared First Load JS | 103 kB | 103 kB | Unchanged |

Production response checks confirmed gzip `Content-Encoding` for HTML and JavaScript, and `Cache-Control: public, max-age=31536000, immutable` for `/_next/static` chunks. Next config now explicitly enables compression and assigns long immutable caching to build-hashed chunks, with one-day caching plus revalidation for public `/icons/` and `/logo/` assets. The existing Caddy config already enables `encode zstd gzip` for proxied responses.

Focused validation: backend typecheck/lint and frontend typecheck/lint passed; `npm run perf:measure` completed against the seeded local test database; a wrong-database seeder invocation was rejected before connecting; and the new production-asset Playwright check passed.
