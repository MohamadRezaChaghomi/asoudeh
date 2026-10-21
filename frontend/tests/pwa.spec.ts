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
    start_url: string;
    icons: Array<{ src: string; type: string }>;
  };
  expect(manifest.start_url).toBe('/dashboard');
  expect(manifest.icons).toContainEqual({
    src: '/icons/asoudeh.svg',
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'any',
  });
  const iconResponse = await page.request.get('/icons/asoudeh.svg');
  expect(iconResponse.ok()).toBe(true);
  expect(iconResponse.headers()['content-type']).toContain('image/svg+xml');

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible();
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
  expect(workerState.cacheNames).toEqual(['asoudeh-static-shell-v1']);
  expect(workerState.cachedUrls).toEqual(['/icons/asoudeh.svg', '/offline.html']);

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
  await expect(page.getByText('اطلاعات مالی شما در حالت آفلاین بارگذاری نمی‌شود.'))
    .toBeVisible();

  await context.setOffline(false);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /ورود/ })).toBeVisible();
});
