import { expect, test } from '@playwright/test';

test('keeps all app routes reachable and preserves the selected theme', async ({ page }) => {
  const clientErrors: string[] = [];
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
  expect(clientErrors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(mobileNavigation).toBeHidden();
  await expect(page.getByRole('link', { name: 'گزارش‌ها' })).toBeVisible();
});
