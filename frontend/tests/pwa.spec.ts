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
    id: string;
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    lang: string;
    dir: string;
    background_color: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
    shortcuts: Array<{ name: string; url: string }>;
  };
  expect(manifest.name).toBe('آسوده | Asoudeh');
  expect(manifest.short_name).toBe('آسوده');
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/dashboard');
  expect(manifest.scope).toBe('/');
  expect(manifest.lang).toBe('fa');
  expect(manifest.dir).toBe('rtl');
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
  expect(manifest.shortcuts).toEqual([
    expect.objectContaining({ name: 'ثبت تراکنش', url: '/transactions?type=expense' }),
    expect.objectContaining({ name: 'دسته‌بندی‌ها', url: '/categories' }),
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
  expect(workerState.cacheNames).toEqual(['asoudeh-static-shell-v5']);
  expect(workerState.cachedUrls).toEqual(['/icons/app-icon.svg', '/offline.html']);
  expect(workerState.cachedUrls).not.toContain('/dashboard');

  await expect(page.getByText('اتصال برقرار است')).toBeVisible();
  await page.evaluate(() => {
    let promptCalled = false;
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, {
      prompt: async () => {
        promptCalled = true;
        (window as Window & { __installPromptCalled?: boolean }).__installPromptCalled = true;
      },
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(installEvent);
    (window as Window & { __installPromptInitiallyCalled?: boolean }).__installPromptInitiallyCalled =
      promptCalled;
  });
  const installButton = page.getByRole('button', { name: 'نصب برنامه' });
  await expect(installButton).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { __installPromptInitiallyCalled?: boolean }).__installPromptInitiallyCalled,
    ),
  ).toBe(false);
  await installButton.click();
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { __installPromptCalled?: boolean }).__installPromptCalled),
  ).toBe(true);

  const iosPage = await context.newPage();
  await iosPage.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
  });
  await iosPage.goto('/login');
  await expect(
    iosPage.getByText('برای نصب، در منوی اشتراک‌گذاری گزینهٔ «افزودن به صفحهٔ اصلی» را بزنید.'),
  ).toBeVisible();
  await iosPage.getByRole('button', { name: 'بستن' }).click();
  await expect(iosPage.getByText(/منوی اشتراک‌گذاری/)).toHaveCount(0);
  await iosPage.close();

  const standalonePage = await context.newPage();
  await standalonePage.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
  });
  await standalonePage.goto('/login');
  await standalonePage.evaluate(() => {
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(installEvent);
  });
  await expect(standalonePage.getByRole('button', { name: 'نصب برنامه' })).toHaveCount(0);
  await standalonePage.close();

  await page.evaluate(async () => {
    const oldCache = await caches.open('asoudeh-static-shell-v3');
    await oldCache.put('/dashboard', new Response('private old cached page'));
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) throw new Error('Service worker registration is missing.');
    await navigator.serviceWorker.register('/sw.js?test-update=1', { scope: '/' });
  });
  await expect(page.getByText('نسخهٔ جدید آسوده آماده است.')).toBeVisible({ timeout: 15_000 });
  const activeScriptBeforeAction = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return registration?.active?.scriptURL ?? '';
  });
  expect(activeScriptBeforeAction).not.toContain('test-update=1');
  await page.getByRole('button', { name: 'به‌روزرسانی' }).click();
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      return registration?.active?.scriptURL.includes('test-update=1') ?? false;
    },
    null,
    { timeout: 15_000 },
  );
  const cachesAfterUpdate = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return { names, urls: urls.sort() };
  });
  expect(cachesAfterUpdate.names).toEqual(['asoudeh-static-shell-v5']);
  expect(cachesAfterUpdate.urls).toEqual(['/icons/app-icon.svg', '/offline.html']);

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
  await expect(page.getByText('اتصال اینترنت برقرار نیست')).toBeVisible();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'اتصال اینترنت در دسترس نیست' }))
    .toBeVisible();
  await expect(page.getByRole('img', { name: 'نشان آسوده' })).toBeVisible();
  await expect(page.getByText('اطلاعات مالی شما در حالت آفلاین بارگذاری نمی‌شود.'))
    .toBeVisible();
  await expect(page.getByRole('link', { name: 'بررسی دوبارهٔ اتصال' })).toHaveAttribute('href', '/');

  await context.setOffline(false);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible();
});
