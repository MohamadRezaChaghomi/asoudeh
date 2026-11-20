# Asoudeh brand integration

## Assets and usage

| Asset | Purpose |
|---|---|
| `frontend/public/logo/asoudeh-symbol.svg` | Approved mark for light surfaces and favicon/PWA exports. |
| `frontend/public/logo/asoudeh-white.svg` | Approved mark for dark surfaces. |
| `frontend/public/icons/favicon.ico` and `favicon-*.png` | ICO frames 16/32/48/64/128/256; standalone PNGs at 16/32/48/64/128. |
| `frontend/public/icons/apple-touch-icon.png` | 180x180 Apple icon. |
| `frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-1024.png` | PWA and high-resolution app icons. |
| `frontend/public/illustrations/empty-transactions.svg`, `empty-budgets.svg`, `empty-reminders.svg` | Decorative illustrations in the matching empty states. |
| `frontend/public/preview/og-image.svg`, `og-image.png` | Source artwork and 1200x630 social preview. |

The two approved marks are used throughout the interface; `BrandLogo` pairs either mark with the Persian text label where appropriate and switches marks with the active theme. Other historical logo SVGs remain unused. Raster icon files are generated from `asoudeh-symbol.svg` by `frontend/scripts/export-assets.mjs`. The social preview SVG uses the approved symbol and is rendered locally with Estedad. The maskable PNG is the same approved symbol.

The supplied `frontend/public/scripts/export-assets.js` was reviewed and contained only a console message; it was not run and is retained under `docs/brand/reference/`. The functional local exporter is under `frontend/scripts/`.

## Logo component

`frontend/components/brand/BrandLogo.tsx` renders only `asoudeh-symbol.svg` or `asoudeh-white.svg`, plus the Persian wordmark. Decorative instances use an empty accessible label when their containing link already names the brand.

## Typography and theme tokens

The application self-hosts variable Estedad through `next/font/local` with Arabic, Latin, and Latin Extended subsets, `display: swap`, and a system fallback. No external font requests are made. Design tokens live in `frontend/styles/tokens.css`; base styles and app-shell, public-page, control, and assistant styles are separated under `frontend/styles/` and imported by the root layout. The offline page uses system fonts only.

The UI keeps the supplied brand greens and neutrals while using contrast-adjusted text, focus, border, and dark-mode action tokens. Text is checked against the 4.5:1 normal-text threshold; focus indicators and meaningful control boundaries are checked against 3:1.

The historical horizontal and primary source SVGs remain in the asset directory but are not used by the interface. The social preview uses a local text label alongside the approved mark.

## Metadata and offline shell

`frontend/app/layout.tsx` declares favicon variants, Apple icon, and OG/Twitter metadata. `frontend/app/manifest.ts` references separate 192x192 and 512x512 general icons and the maskable 512x512 icon. Theme colors match the CSS tokens.

`frontend/public/sw.js` uses cache `asoudeh-static-shell-v8`, pre-caching only `/offline.html` and `/logo/asoudeh-symbol.svg`. It does not cache authenticated pages or API responses. The offline page has a system-font stack and a retry action.

Brand documentation and reference mockups are under `docs/brand/`; they are not shipped from `public/`.

## Verification

- As of 2026-11-21, the full frontend Playwright run passed 72 tests with one intentional production-only PWA skip. After the latest asset cleanup, all four brand-asset, logo-dimension, ICO, and contrast tests passed again.
- Frontend lint, typecheck, and production build passed after the current cleanup. See [TESTING.md](./TESTING.md) for exact scope and backend database-test limitations.
- These automated checks do not certify WCAG conformance, installation behavior on every device, live provider delivery, or production performance.

## Asset notes

- Historical primary and horizontal logos are unused and should not be reintroduced into the UI.
- Source mockups are reference-only and remain under `docs/brand/mockups/`.
