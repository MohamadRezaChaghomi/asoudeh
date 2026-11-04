# Asoudeh brand integration

## Brand asset locations

The supplied package is present in `frontend/public/logo/`, `frontend/public/icons/`, and `frontend/public/preview/`; it does not use the proposed `frontend/public/brand/` directory. The assets were kept at their supplied paths.

| Asset | Use |
|---|---|
| `frontend/public/logo/asoudeh-primary.svg` | Primary identity on authentication cards. |
| `frontend/public/logo/asoudeh-horizontal.svg` | Public header/footer, light dashboard sidebar. |
| `frontend/public/logo/asoudeh-symbol.svg` | Compact mobile dashboard header. |
| `frontend/public/logo/asoudeh-white.svg` | Dark dashboard sidebar, on a forest-green tile. |
| `frontend/public/logo/asoudeh-monochrome.svg` | Available for monochrome contexts; not needed in the current UI. |
| `frontend/public/icons/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` | Browser favicon variants. |
| `frontend/public/icons/apple-touch-icon.png` | Apple home-screen icon (180×180). |
| `frontend/public/icons/icon-192.png`, `icon-512.png` | Installable app icons. |
| `frontend/public/icons/icon-maskable-512.png` | Maskable PWA icon, kept as a separate manifest entry. |
| `frontend/public/icons/app-icon.svg` | Offline-page mark and cached service-worker shell asset. |
| `frontend/public/icons/icon-1024.png` and other supplied sizes | Retained supplied exports; not referenced by the current manifest. |

All referenced files were verified to exist. PNG dimensions were read from their headers; the ICO contains 16, 32, 48, 64, 128, and 256 pixel frames. Logo SVGs preserve their viewBox proportions.

## Shared logo component and application usage

`frontend/components/brand/BrandLogo.tsx` is the single UI component that maps a typed variant (`primary`, `horizontal`, `symbol`, `white`, or `monochrome`) to its asset path and intrinsic dimensions. It supports semantic sizes, optional alt text, priority loading, and decorative use. Images use `object-fit: contain`; the intrinsic dimensions reserve their ratio before load.

- Login and OTP verification use the primary identity.
- The public header/footer use the horizontal identity and avoid an extra duplicated wordmark.
- The dashboard desktop sidebar uses the horizontal mark on light theme and the white identity on a forest-green tile in dark theme.
- The mobile dashboard header uses the square symbol at a compact size.
- Functional navigation and action icons remain Lucide icons; the brand mark does not replace them.
- All financial routes share the dashboard shell. Public routes share the public header/footer; authentication routes use the same primary logo.

## Theme integration

The light-theme design tokens now use the supplied forest green `#1F5C4A`, balance green `#2E7D5B`, mint `#D9EBDD`, warm neutral `#F6F7F2`, charcoal `#1D2925`, secondary text `#63756D`, and amber focus accent `#D89A5B`. Dark theme retains accessible light text colors and uses dedicated dark-theme action colors to keep white button labels legible. Existing status colors and focus-visible outlines remain.

The SVG wordmarks contain editable Persian/Latin text and specify Vazirmatn/Inter font families. No font files were included in the supplied package or frontend assets, so browsers use the documented font fallback stack. For identical wordmark shaping on systems without Vazirmatn, supply a licensed local font file or path-based logo artwork.

## Metadata, favicon, manifest, and offline shell

- The Next.js 15 App Router root metadata declares the application name, title template, manifest, all supplied favicon variants, and Apple touch icon. The root viewport declares the forest-green theme color.
- `frontend/app/manifest.ts` keeps the existing `/dashboard` standalone install flow, Persian/RTL metadata, and brand colors. It lists separate 192×192 and 512×512 general-purpose icons and the supplied maskable 512×512 icon.
- The prior service worker and offline document had local deletions. After inspecting their committed implementation/history and confirming restoration with the user, the original navigation-only offline fallback and narrow static-shell cache behavior were restored. The cache version was incremented to `v2`, and only the offline page plus supplied app mark are pre-cached. The worker does not cache authenticated pages or API/financial data.

## Files changed for integration

- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/verify-otp/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/app/manifest.ts`
- `frontend/components/brand/BrandLogo.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/public/PublicPagesLayout.tsx`
- `frontend/public/offline.html`
- `frontend/public/sw.js`
- `frontend/tests/app-shell.spec.ts`
- `frontend/tests/auth.spec.ts`
- `frontend/tests/public-pages.spec.ts`
- `frontend/tests/pwa.spec.ts`
- `frontend/tests/responsive.spec.ts`
- `docs/BRAND_INTEGRATION.md`

The untracked supplied brand guide, README, logo/icon PNG/SVGs, and preview assets are user-provided files and were not regenerated or modified.

## Verification and remaining issues

Verified with the installed Next.js 15.5.28 toolchain and Microsoft Edge:

- Frontend typecheck: passed.
- Frontend lint: passed.
- Production build: passed; 22 routes were generated.
- Jalali unit tests: 4 passed.
- Complete frontend Playwright suite: 37 passed, 1 intentionally skipped. The skip is the production-only PWA test when running against the development server.
- Separate production PWA Playwright test: 1 passed. It verified metadata and icon URLs, manifest values and icon purposes, service-worker control, the exact static-shell cache contents, no cached API URLs, and the offline fallback.
- `git diff --check`: passed.

An initial run used the default parallel workers while a production PWA server was being started at the same time. The competing dev/production processes affected the shared Next.js build directory and caused browser-test timeouts. The production PWA test was rerun after a fresh build, and the complete browser suite was rerun serially; both passed as reported above.

Remaining issue: Vazirmatn and Inter font files are absent, so wordmark typography depends on fonts available on the client device. The legacy exported logos were removed from the current worktree by the supplied asset update and are no longer referenced; other unreferenced supplied icon sizes are retained.
