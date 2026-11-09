import { expect, test } from '@playwright/test';

test('serves the configured security response headers', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response?.headers()['content-security-policy']).toContain("font-src 'self'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('loads self-hosted Estedad for Persian and Latin without CSP or hydration errors', async ({
  page,
}) => {
  const fontErrors: string[] = [];
  const fontResponses: Array<{ url: string; status: number }> = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security policy|refused to load.*font|hydration/i.test(message.text())
    ) {
      fontErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (/hydration/i.test(error.message)) fontErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (/\.woff2?(?:\?|$)/i.test(response.url())) {
      fontResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto('/');
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily).toContain('system-ui');

  const fontLoading = await page.evaluate(async () => {
    const sample = `آسوده Asoudeh ۱۲۳ ۱۲۳٬۴۵۶ 123,456`;
    const probe = document.createElement('span');
    probe.textContent = sample;
    probe.style.fontFamily = getComputedStyle(document.body).fontFamily;
    probe.style.fontWeight = '400';
    document.body.append(probe);
    await document.fonts.load(`400 18px ${probe.style.fontFamily}`, sample);
    await document.fonts.ready;
    const formattedAmount = new Intl.NumberFormat('fa-IR').format(123456);
    const amountProbe = document.createElement('bdi');
    amountProbe.className = 'financial-amount';
    document.body.append(amountProbe);
    const amountNumericStyle = getComputedStyle(amountProbe).fontVariantNumeric;
    probe.remove();
    amountProbe.remove();

    return {
      fontOrigins: performance
        .getEntriesByType('resource')
        .filter((entry) => /\.woff2?(?:\?|$)/i.test(entry.name))
        .map((entry) => new URL(entry.name).origin),
      formattedAmount,
      amountNumericStyle,
    };
  });

  expect(fontLoading.fontOrigins.length).toBeGreaterThanOrEqual(2);
  expect(fontLoading.fontOrigins.every((origin) => origin === new URL(page.url()).origin)).toBe(true);
  expect(fontLoading.formattedAmount).toBe('۱۲۳٬۴۵۶');
  expect(fontLoading.amountNumericStyle).toContain('tabular-nums');
  expect(fontResponses.length).toBeGreaterThanOrEqual(2);
  expect(fontResponses.every(({ status }) => status === 200)).toBe(true);
  expect(fontErrors).toEqual([]);
});

test('compresses production pages and caches static assets', async ({ page }) => {
  const pageResponse = await page.goto('/');
  expect(pageResponse?.headers()['content-encoding']).toBe('gzip');

  const assetResponse = await page.request.get('/icons/icon-192.png');
  expect(assetResponse.ok()).toBe(true);
  expect(assetResponse.headers()['cache-control']).toBe(
    'public, max-age=86400, stale-while-revalidate=604800',
  );
});

test('keeps all app routes reachable and preserves the selected theme', async ({ page }) => {
  const clientErrors: string[] = [];
  let activityRequests = 0;
  let profileRequests = 0;
  page.on('pageerror', (error) => clientErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') clientErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      clientErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.route('**/api/v1/me', async (route) => {
    profileRequests += 1;
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'app-shell-user',
            accessibilitySettings: { fontScale: 1.25, highContrast: true },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken: 'app-shell-csrf' } } });
  });
  await page.route('**/api/v1/auth/activity', async (route) => {
    activityRequests += 1;
    await route.fulfill({ json: { success: true, data: { active: true } } });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({ json: { success: true, data: { categories: [] } } });
  });
  await page.route('**/api/v1/budgets**', async (route) => {
    const monthKey = new URL(route.request().url()).searchParams.get('month') ?? '';
    await route.fulfill({
      json: {
        success: true,
        data: {
          monthKey,
          period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
          budgets: [],
        },
      },
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/budgets');

  const mobileNavigation = page.locator('.mobile-nav');
  const mobileMenuToggle = page.getByRole('button', { name: 'بازکردن ناوبری' });
  await expect(mobileMenuToggle).toBeVisible();
  await expect(mobileNavigation).toBeHidden();
  await mobileMenuToggle.click();
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole('link')).toHaveCount(10);
  await expect(mobileNavigation.getByRole('link', { name: 'راهنمای استفاده' })).toHaveAttribute(
    'href',
    '/guide',
  );
  for (const link of await mobileNavigation.getByRole('link').all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  await expect(mobileNavigation.getByRole('link', { name: 'بودجه‌ها' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.keyboard.press('Escape');
  await expect(mobileNavigation).toBeHidden();

  await mobileMenuToggle.click();
  await mobileNavigation.getByRole('link', { name: 'دسته‌ها' }).click();
  await expect(
    page.getByRole('heading', { name: 'دسته‌بندی‌ها', exact: true }),
  ).toBeVisible();
  await expect.poll(() => profileRequests).toBe(1);
  await expect(page.locator('html')).toHaveCSS('font-size', '20px');
  await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');

  await page.getByRole('button', { name: 'فعال‌کردن پوسته تیره' }).click();
  await expect.poll(() => activityRequests).toBe(1);
  expect(clientErrors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['asoudeh.theme']);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(mobileNavigation).toBeHidden();
  await expect(page.getByRole('link', { name: 'گزارش‌ها' })).toBeVisible();
  const logo = page.locator('.app-sidebar .brand-logo-image');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/logo/asoudeh-white.svg');
  const logoWidth = await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth);
  expect(logoWidth).toBeGreaterThan(0);
  const logoBackground = await logo.evaluate(
    (image) => getComputedStyle(image.parentElement!).backgroundColor,
  );
  const expectedLogoBackground = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--brand-action)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(logoBackground).toBe(expectedLogoBackground);
  await expect(page.getByRole('link', { name: 'آسوده، نمای کلی' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLogo = page.locator('.app-topbar-brand img');
  await expect(mobileLogo).toHaveAttribute('src', '/logo/asoudeh-symbol.svg');
  const mobileLogoBounds = await mobileLogo.boundingBox();
  expect(mobileLogoBounds?.width).toBeLessThanOrEqual(48);
  expect(mobileLogoBounds?.height).toBeLessThanOrEqual(48);
  await mobileMenuToggle.click();
  await mobileNavigation.getByRole('link', { name: 'راهنمای استفاده' }).click();
  await expect(page.getByRole('heading', { name: 'راهنمای استفاده' })).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await expect(page.locator('html')).not.toHaveAttribute('data-high-contrast');
});

test('shows a page-shaped budget skeleton while data is loading and removes it after success', async ({
  page,
}) => {
  let releaseBudgetResponse!: () => void;
  const budgetResponse = new Promise<void>((resolve) => {
    releaseBudgetResponse = resolve;
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'skeleton-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({ json: { success: true, data: { categories: [] } } });
  });
  await page.route('**/api/v1/budgets**', async (route) => {
    await budgetResponse;
    const monthKey = new URL(route.request().url()).searchParams.get('month') ?? '';
    await route.fulfill({
      json: {
        success: true,
        data: {
          monthKey,
          period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
          budgets: [],
        },
      },
    });
  });

  await page.goto('/budgets');
  const loadingStatus = page
    .getByRole('status')
    .filter({ hasText: 'در حال بارگذاری بودجه‌ها…' });
  await expect(loadingStatus).toHaveCount(1);
  await expect(loadingStatus).toHaveText('در حال بارگذاری بودجه‌ها…');
  expect(await page.locator('.skeleton-block').count()).toBeGreaterThan(10);
  releaseBudgetResponse();
  await expect(loadingStatus).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'بودجه‌ها', exact: true })).toBeVisible();
});

test('reads visible page text with a Persian system voice and can stop speech', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeUtterance {
      lang = '';
      voice: unknown;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(readonly text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FakeUtterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ lang: 'fa-IR' }],
        cancel: () => {},
        speak: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'speech-test-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/budgets**', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          monthKey: '07-1405',
          period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
          budgets: [],
        },
      },
    });
  });

  await page.goto('/budgets');
  const readButton = page.getByRole('button', { name: 'خواندن متن صفحه' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(readButton.locator('svg')).toBeVisible();
  await readButton.click();
  await expect(page.getByRole('button', { name: 'توقف خواندن' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#page-reader-status')).toContainText('خواندن متن صفحه آغاز شد.');
  await page.getByRole('button', { name: 'توقف خواندن' }).click();
  await expect(readButton).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#page-reader-status')).toContainText('خواندن متن متوقف شد.');
});

test('explains when the browser has no Persian speech voice', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel: () => {},
        speak: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'speech-no-voice-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/budgets**', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          monthKey: '07-1405',
          period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
          budgets: [],
        },
      },
    });
  });

  await page.goto('/budgets');
  await page.getByRole('button', { name: 'خواندن متن صفحه' }).click();
  await expect(page.locator('#page-reader-status')).toContainText(
    'صدای فارسی در مرورگر یا سیستم شما در دسترس نیست.',
  );
  await expect(page.getByRole('button', { name: 'خواندن متن صفحه' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
