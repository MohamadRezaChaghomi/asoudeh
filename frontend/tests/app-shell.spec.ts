import { expect, test } from '@playwright/test';

test('keeps all app routes reachable and preserves the selected theme', async ({ page }) => {
  const clientErrors: string[] = [];
  let activityRequests = 0;
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
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'app-shell-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
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
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole('link')).toHaveCount(8);
  for (const link of await mobileNavigation.getByRole('link').all()) {
    const bounds = await link.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  await expect(mobileNavigation.getByRole('link', { name: 'بودجه‌ها' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'فعال‌کردن پوسته تیره' }).click();
  await expect.poll(() => activityRequests).toBe(1);
  expect(clientErrors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(mobileNavigation).toBeHidden();
  await expect(page.getByRole('link', { name: 'گزارش‌ها' })).toBeVisible();
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
