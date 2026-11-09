import { expect, test } from '@playwright/test';

test('does not register a service worker in development', async ({ page }) => {
  test.skip(process.env.PWA_TEST === 'true');
  await page.goto('/');
  const registrations = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).length,
  );
  expect(registrations).toBe(0);
});

test('production PWA loads its manifest and keeps offline cache free of account data', async ({
  page,
  context,
}) => {
  test.skip(process.env.PWA_TEST !== 'true');

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json() as {
    name: string;
    short_name: string;
    start_url: string;
    background_color: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };
  expect(manifest.name).toBe('آسوده | Asoudeh');
  expect(manifest.short_name).toBe('آسوده');
  expect(manifest.start_url).toBe('/dashboard');
  expect(manifest.theme_color).toBe('#1F5C4A');
  expect(manifest.background_color).toBe('#F6F7F2');
  expect(manifest.icons).toEqual([
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ]);
  for (const icon of [
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
  ]) {
    const iconResponse = await page.request.get(icon);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }
  const metadataIcons = await page.request.get('/icons/favicon.ico');
  expect(metadataIcons.ok()).toBe(true);
  const appleIcon = await page.request.get('/icons/apple-touch-icon.png');
  expect(appleIcon.ok()).toBe(true);
  const appIcon = await page.request.get('/icons/app-icon.svg');
  expect(appIcon.ok()).toBe(true);

  const fontIssues: string[] = [];
  const fontResponses: Array<{ url: string; status: number }> = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security policy|refused to load.*font|hydration/i.test(message.text())
    ) {
      fontIssues.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (/hydration/i.test(error.message)) fontIssues.push(error.message);
  });
  page.on('response', (response) => {
    if (/\.woff2?(?:\?|$)/i.test(response.url())) {
      fontResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const loginResponse = await page.goto('/login');
  expect(loginResponse?.headers()['content-security-policy']).toContain("font-src 'self'");
  await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible();
  const fontOrigins = await page.evaluate(async () => {
    const sample = 'آسوده Asoudeh ۱۲۳ ۱۲۳٬۴۵۶ 123,456';
    const probe = document.createElement('span');
    probe.textContent = sample;
    probe.style.fontFamily = getComputedStyle(document.body).fontFamily;
    document.body.append(probe);
    await document.fonts.load(`400 18px ${probe.style.fontFamily}`, sample);
    await document.fonts.ready;
    probe.remove();
    return performance
      .getEntriesByType('resource')
      .filter((entry) => /\.woff2?(?:\?|$)/i.test(entry.name))
      .map((entry) => new URL(entry.name).origin);
  });
  expect(fontOrigins.length).toBeGreaterThanOrEqual(2);
  expect(fontOrigins.every((origin) => origin === new URL(page.url()).origin)).toBe(true);
  expect(fontResponses.length).toBeGreaterThanOrEqual(2);
  expect(fontResponses.every(({ status }) => status === 200)).toBe(true);
  expect(fontIssues).toEqual([]);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute(
    'href',
    '/icons/favicon-32x32.png',
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon.png',
  );
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const cachedUrls: string[] = [];
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      cachedUrls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return {
      scope: registration.scope,
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheNames,
      cachedUrls: cachedUrls.sort(),
    };
  });
  expect(workerState.controlled).toBe(true);
  expect(workerState.cacheNames).toEqual(['asoudeh-static-shell-v2']);
  expect(workerState.cachedUrls).toEqual(['/icons/app-icon.svg', '/offline.html']);

  await page.evaluate(async () => {
    await fetch('/api/v1/reports/monthly?month=01-1405').catch(() => undefined);
  });
  const cachedApiUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls.filter((url) => url.includes('/api/'));
  });
  expect(cachedApiUrls).toEqual([]);

  await context.setOffline(true);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'اتصال اینترنت در دسترس نیست' }))
    .toBeVisible();
  await expect(page.getByRole('img', { name: 'نشان آسوده' })).toBeVisible();
  await expect(page.getByText('اطلاعات مالی شما در حالت آفلاین بارگذاری نمی‌شود.'))
    .toBeVisible();

  await context.setOffline(false);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible();
});
