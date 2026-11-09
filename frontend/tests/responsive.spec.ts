import { expect, test } from './diagnostics-test';

const userId = '64b000000000000000000099';
const seniorId = '64b000000000000000000023';
const responsiveViewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];
const additionalViewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 600, height: 900 },
  { width: 820, height: 1180 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
  { width: 1920, height: 1080 },
  { width: 844, height: 390 },
];
const routes = [
  '/',
  '/login',
  '/verify-otp',
  '/dashboard',
  '/transactions',
  '/transactions/new',
  '/categories',
  '/budgets',
  '/reports',
  '/reminders',
  '/caregiver',
  `/caregiver/${seniorId}`,
  '/settings',
];

test('keeps every application route usable at mobile, tablet, and desktop widths', async ({
  page,
}) => {
  test.setTimeout(180_000);

  const pageErrors: string[] = [];
  const failedApiRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      failedApiRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/v1/')) {
      failedApiRequests.push(`Request failed: ${request.url()}`);
    }
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'asoudeh.pendingOtp',
      JSON.stringify({
        phone: '09121234567',
        resendAvailableAt: Date.now(),
        step: 'register',
      }),
    );
  });
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const profile = {
      id: userId,
      displayName: 'کاربر آزمون',
      phone: '09121234567',
      birthYear: null,
      initialBalance: 0,
      accessibilitySettings: { fontScale: 1, highContrast: false },
    };
    let data: Record<string, unknown> = {};

    if (pathname.endsWith('/auth/csrf')) {
      data = { csrfToken: 'responsive-test-csrf' };
    } else if (pathname.endsWith('/auth/activity')) {
      data = { active: true };
    } else if (pathname.endsWith('/me')) {
      data = { profile };
    } else if (pathname.endsWith('/dashboard')) {
      data = {
        period: {
          calendar: 'jalali',
          year: 1405,
          month: 7,
          startDate: '2026-09-23',
          endDateExclusive: '2026-10-23',
        },
        balance: { initialBalance: 0, income: '0', expenses: '0', remaining: '0' },
        recentTransactions: [],
        upcomingReminders: [],
      };
    } else if (pathname.endsWith('/transactions')) {
      data = {
        transactions: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      };
    } else if (pathname.endsWith('/categories')) {
      data = { categories: [] };
    } else if (pathname.endsWith('/budgets')) {
      data = {
        monthKey: '07-1405',
        period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
        budgets: [],
      };
    } else if (pathname.endsWith('/reports/monthly')) {
      data = {
        report: {
          monthKey: '07-1405',
          totals: { income: '0', expenses: '0', transactionCount: 0 },
          comparison: {
            previousMonthKey: '06-1405',
            previousExpenses: '0',
            expenseChange: '0',
            expenseChangePercentage: null,
          },
          expensesByCategory: [],
        },
      };
    } else if (pathname.endsWith('/reminders')) {
      data = { monthKey: '07-1405', reminders: [] };
    } else if (pathname.endsWith('/caregiver/links')) {
      data = { links: [] };
    } else if (pathname.endsWith('/caregiver/invitations')) {
      data = { invitations: [] };
    } else if (pathname.endsWith('/caregiver/seniors')) {
      data = {
        seniors: [{
          seniorId,
          seniorName: 'کاربر آزمون',
          permissions: ['VIEW_SUMMARY', 'VIEW_TRANSACTIONS', 'VIEW_REPORTS'],
        }],
      };
    } else if (pathname.endsWith(`/caregiver/seniors/${seniorId}/summary`)) {
      data = {
        summary: {
          period: { monthKey: '07-1405' },
          balance: { initialBalance: 0, income: '0', expenses: '0', remaining: '0' },
        },
      };
    } else if (pathname.endsWith(`/caregiver/seniors/${seniorId}/transactions`)) {
      data = { transactions: [] };
    } else if (pathname.endsWith(`/caregiver/seniors/${seniorId}/reports/monthly`)) {
      data = {
        report: {
          monthKey: '07-1405',
          totals: { income: '0', expenses: '0', transactionCount: 0 },
          expensesByCategory: [],
        },
      };
    } else {
      await route.fulfill({ status: 404, json: { success: false } });
      return;
    }

    await route.fulfill({ json: { success: true, data } });
  });

  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);

    for (const path of routes) {
      await page.goto(path);
      const heading = page.locator('main h1').first();
      await expect(heading, `${path} at ${viewport.width}px`).toBeVisible();
      const headingBounds = await heading.boundingBox();
      expect(headingBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((headingBounds?.x ?? 0) + (headingBounds?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
      const logo = page.locator('img.brand-logo-image:visible').first();
      await expect(logo).toBeVisible();
      const logoMetrics = await logo.evaluate((image: HTMLImageElement) => ({
        sourceAspectRatio: image.naturalWidth / image.naturalHeight,
        objectFit: getComputedStyle(image).objectFit,
        bounds: image.getBoundingClientRect().toJSON(),
      }));
      expect(logoMetrics.sourceAspectRatio).toBeGreaterThan(0);
      expect(logoMetrics.objectFit).toBe('contain');
      expect(logoMetrics.bounds.x).toBeGreaterThanOrEqual(0);
      expect(logoMetrics.bounds.right).toBeLessThanOrEqual(viewport.width);

      if (
        viewport.width > 700 &&
        path !== '/' &&
        path !== '/login' &&
        path !== '/verify-otp'
      ) {
        await expect(page.locator('.app-sidebar')).toBeVisible();
        await expect(page.locator('.mobile-menu-toggle')).toBeHidden();
      }

      if (path === '/dashboard') {
        for (const label of ['ثبت هزینه', 'ثبت درآمد']) {
          const action = page.getByRole('link', { name: label });
          await expect(action).toBeVisible();
          const bounds = await action.boundingBox();
          expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
            viewport.width,
          );
        }
        await page.screenshot({
          path: `test-results/responsive-dashboard-${viewport.width}.png`,
          fullPage: true,
        });
      }

      if (path === '/login' && [320, 768, 1440].includes(viewport.width)) {
        await page.screenshot({
          path: `test-results/responsive-login-${viewport.width}.png`,
          fullPage: true,
        });
      }

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(
        dimensions.documentWidth,
        `Unexpected horizontal overflow on ${path} at ${viewport.width}px`,
      ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

      if (
        viewport.width <= 700 &&
        path !== '/' &&
        path !== '/login' &&
        path !== '/verify-otp'
      ) {
        const menuToggle = page.locator('.mobile-menu-toggle');
        const mobileNavigation = page.getByRole('navigation', { name: 'ناوبری اصلی' });
        await expect(menuToggle).toBeVisible();
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
        await menuToggle.click();
        await expect(mobileNavigation).toBeVisible();
        await expect(mobileNavigation.getByRole('link')).toHaveCount(10);
        await expect(
          mobileNavigation.getByRole('link', { name: 'راهنمای استفاده' }),
        ).toHaveAttribute('href', '/guide');
        for (const link of await mobileNavigation.getByRole('link').all()) {
          const bounds = await link.boundingBox();
          expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(48);
          expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        }

        if (path === '/dashboard') {
          await page.keyboard.press('Escape');
          await expect(mobileNavigation).toBeHidden();
          await menuToggle.click();
          const transactionsLink = mobileNavigation.getByRole('link', { name: 'تراکنش‌ها' });
          await expect(transactionsLink).toHaveAttribute('href', '/transactions');
          const hitTest = await transactionsLink.evaluate((link) => {
            const bounds = link.getBoundingClientRect();
            const target = document.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            return { isLinkTarget: Boolean(target && link.contains(target)) };
          });
          expect(hitTest.isLinkTarget).toBe(true);
          await transactionsLink.click();
          await expect(page).toHaveURL(/\/transactions$/);
          await expect(mobileNavigation).toBeHidden();
        } else {
          await menuToggle.click();
          await expect(mobileNavigation).toBeHidden();
        }
      }
    }
  }

  for (const viewport of additionalViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
    await expect(page.locator('img.brand-logo-image:visible').first()).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(
      dimensions.documentWidth,
      `Unexpected horizontal overflow on /dashboard at ${viewport.width}px`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  }

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible();
  await expect(page.locator('img.brand-logo-image[alt="نشان آسوده"]:visible').first())
    .toBeVisible();
  const loginDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(loginDimensions.documentWidth).toBeLessThanOrEqual(loginDimensions.viewportWidth + 1);
  await page.screenshot({ path: 'test-results/responsive-login-320.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'فعال‌کردن پوسته تیره' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const darkThemeDimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(darkThemeDimensions.documentWidth).toBeLessThanOrEqual(
    darkThemeDimensions.viewportWidth + 1,
  );

  expect(pageErrors).toEqual([]);
  expect(failedApiRequests).toEqual([]);
});
