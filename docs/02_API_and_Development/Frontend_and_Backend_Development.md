# Frontend and Backend Development

## Project structure

```text
backend/
  src/config/       Environment validation and database connection
  src/controllers/  HTTP request/response handlers
  src/middleware/   Authentication, CSRF, Origin, errors, and logging
  src/models/       Mongoose schemas and indexes
  src/routes/       Express route registration
  src/services/     Authentication and domain/business logic
  src/tests/        API, integration, and unit tests
  src/validators/   Zod request schemas
frontend/
  app/              App Router pages, layouts, metadata, and CSS entry
  components/       Shared shell, brand, forms, and UI
  lib/              API client and shared utilities
  public/            PWA shell, icons, illustrations, and previews
  scripts/           Type generation, performance budget, and asset export
  styles/            Design tokens and modular global styles
  tests/             Playwright and Node utility tests
```

## Development commands

Run commands from the repository root unless noted:

```powershell
npm run install:all
npm run dev:backend
npm run dev:frontend
npm run lint
npm run typecheck
npm run test:backend
npm --prefix frontend run test:jalali
npm run test:e2e
npm run build:backend
npm run build:frontend
```

The backend listens on port `5000` and the frontend on port `3000` by default. Local environment setup and service configuration are documented in [Environment_and_Services.md](./Environment_and_Services.md). Backend API tests require the isolated local `asoudeh_test` database; do not bypass their safety guard.

For Microsoft Edge and the production PWA path, use PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PWA_TEST = 'true'
Set-Location frontend
npx playwright test --workers=4
Set-Location ..
Remove-Item Env:PLAYWRIGHT_CHANNEL
Remove-Item Env:PWA_TEST
```

## Implementation conventions

- Keep changes focused and follow the existing TypeScript, route/controller/service/model, validation, CSS-token, and test patterns.
- Treat API validators as the boundary for untrusted input. Services derive ownership from the authenticated identity.
- Add focused tests for new behavior and safety boundaries. Cover loading, empty, error, and retry states for relevant UI flows.
- Keep secrets out of frontend code, `NEXT_PUBLIC_*` variables, tests, screenshots, logs, and version control.
- Before completion, run the relevant tests plus lint and typecheck; build before release-impacting changes. Review only the intended changes before staging.
- Do not implement bank connectivity, transfer of money, financial advice, or other deferred features without approved product and privacy requirements.

## Definition of done

A feature should have a validated backend/API contract where applicable, authorization and ownership checks, a connected frontend path, meaningful loading/empty/error states, focused tests, and mobile/responsive review. A passing local build is not evidence of production operation or real-user usability.

## Brand integration

The application uses the approved Asoudeh symbol assets and Persian name. `BrandLogo` selects `asoudeh-symbol.svg` for light surfaces and `asoudeh-white.svg` for dark surfaces; historical logo variants are archival and should not be reintroduced into the UI.

| Asset group | Location and use |
|---|---|
| Approved marks | `frontend/public/logo/asoudeh-symbol.svg`, `asoudeh-white.svg`; favicon/PWA exports are derived from the symbol. |
| Browser and PWA icons | `frontend/public/icons/`; the maskable PNG is the approved symbol. |
| Empty-state artwork | `frontend/public/illustrations/` for the matching feature empty states. |
| Social preview | `frontend/public/preview/og-image.svg` and `og-image.png`. |
| Design tokens and styles | `frontend/styles/tokens.css` and modular styles imported by the root layout. |

Estedad is self-hosted with `next/font/local`, Arabic/Latin subsets, `display: swap`, and a system fallback. No external font request is required. The offline page uses system fonts. The current theme uses contrast-adjusted text, focus, border, and dark-mode action tokens; automated contrast checks do not certify WCAG conformance.

Raster favicon/PWA exports are produced by `frontend/scripts/export-assets.mjs`. The service worker caches only the generic offline page and symbol; it excludes authenticated pages and API responses. The SVG mark and typography guidance remain in the [brand guidelines](../brand/BRAND-GUIDELINES.md); source mockups under `docs/brand/` are reference-only.

## Further references

- [API_Documentation.md](./API_Documentation.md) — registered API methods and response contracts.
- [System_Architecture.md](../01_Architecture_and_Design/System_Architecture.md) — component boundaries and data flow.
- [Testing_and_Performance.md](../04_Academic_and_Quality/Testing_and_Performance.md) — test layers, safe execution, and measured results.
