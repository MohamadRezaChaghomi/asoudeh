import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const pageRoutes: { path: string; label: string; otp?: boolean }[] = [
  { path: '/login', label: 'login' },
  { path: '/verify-otp', label: 'verify-otp', otp: true },
  { path: '/dashboard', label: 'dashboard' },
  { path: '/transactions', label: 'transactions' },
  { path: '/budgets', label: 'budgets' },
  { path: '/reminders', label: 'reminders' },
  { path: '/reports', label: 'reports' },
  { path: '/settings', label: 'settings' },
  { path: '/caregiver', label: 'caregiver' },
];

const themes = [
  { name: 'light', colorScheme: 'light' as const },
  { name: 'dark', colorScheme: 'dark' as const },
  { name: 'high-contrast', colorScheme: 'light' as const },
];
const allowedLatinText = new Set(['Asoudeh', 'SMS.ir', 'FAQ', 'API']);

async function installApiFixtures(page: Page): Promise<(highContrast: boolean) => void> {
  let highContrastPreference = false;
  await page.route('**/*', async (route) => {
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const fixturePaths = [
      '/auth/csrf',
      '/auth/activity',
      '/auth/refresh',
      '/me',
      '/dashboard',
      '/transactions',
      '/categories',
      '/budgets',
      '/reminders',
      '/reports/monthly',
      '/caregiver/links',
      '/caregiver/invitations',
      '/caregiver/seniors',
      '/assistant/status',
    ];
    if (!fixturePaths.includes(path) && !path.startsWith('/caregiver/seniors/')) {
      await route.continue();
      return;
    }

    let data: Record<string, unknown> = {};

    if (path === '/auth/csrf') data = { csrfToken: 'axe-test-csrf-token' };
    else if (path === '/auth/activity') data = { active: true };
    else if (path === '/auth/refresh') data = { refreshed: true };
    else if (path === '/me') {
      data = {
        profile: {
          id: 'axe-test-user',
          displayName: 'کاربر آزمایشی',
          phone: '09121234567',
          birthYear: 1360,
          initialBalance: 0,
          accessibilitySettings: { fontScale: 1, highContrast: highContrastPreference },
        },
      };
    } else if (path === '/dashboard') {
      data = {
        period: {
          calendar: 'jalali',
          year: 1405,
          month: 8,
          startDate: '2026-10-23',
          endDateExclusive: '2026-11-22',
        },
        balance: { initialBalance: 0, income: '0', expenses: '0', remaining: '0' },
        recentTransactions: [],
        upcomingReminders: [],
      };
    } else if (path === '/transactions') {
      data = {
        transactions: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      };
    } else if (path === '/categories') {
      data = {
        categories: [
          {
            id: 'axe-test-category',
            name: 'خوراک',
            type: 'expense',
            isActive: true,
            isDefault: false,
          },
        ],
      };
    } else if (path === '/budgets') {
      data = {
        monthKey: '08-1405',
        period: { startDate: '2026-10-23', endDateExclusive: '2026-11-22' },
        budgets: [
          {
            id: 'axe-test-budget',
            categoryId: 'axe-test-category',
            categoryName: 'خوراک',
            categoryIcon: '🍎',
            categoryIsActive: true,
            monthKey: '08-1405',
            limitAmount: 1_000_000,
            spentAmount: '800000',
            remainingAmount: '200000',
            percentageUsed: 80,
            status: 'warning',
          },
        ],
      };
    } else if (path === '/reminders') data = { monthKey: '08-1405', reminders: [] };
    else if (path === '/reports/monthly') {
      data = {
        report: {
          monthKey: '08-1405',
          period: { startDate: '2026-10-23', endDateExclusive: '2026-11-22' },
          totals: { income: '0', expenses: '0', transactionCount: 0 },
          comparison: {
            previousMonthKey: '07-1405',
            previousExpenses: '0',
            expenseChange: '0',
            expenseChangePercentage: null,
          },
          expensesByCategory: [],
        },
      };
    } else if (path === '/caregiver/links') data = { links: [] };
    else if (path === '/caregiver/invitations') data = { invitations: [] };
    else if (path === '/caregiver/seniors') data = { seniors: [] };
    else if (path === '/assistant/status') data = { available: false };

    await route.fulfill({ json: { success: true, data } });
  });
  return (highContrast) => {
    highContrastPreference = highContrast;
  };
}

for (const route of pageRoutes) {
  test(`axe: ${route.label} page passes WCAG 2.2 AA in light, dark and high contrast`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const setHighContrastPreference = await installApiFixtures(page);

    for (const theme of themes) {
      setHighContrastPreference(theme.name === 'high-contrast');
      await page.emulateMedia({ colorScheme: theme.colorScheme });
      await page.addInitScript(
        ({ selectedTheme, highContrast }) => {
          localStorage.setItem('asoudeh.theme', selectedTheme);
          if (highContrast) document.documentElement.dataset.highContrast = 'true';
        },
        {
          selectedTheme: theme.name === 'dark' ? 'dark' : 'light',
          highContrast: theme.name === 'high-contrast',
        },
      );
      if (route.otp) {
        await page.addInitScript(() => {
          sessionStorage.setItem(
            'asoudeh.pendingOtp',
            JSON.stringify({
              phone: '09121234567',
              resendAvailableAt: Date.now() + 60_000,
              step: 'code',
            }),
          );
        });
      }

      await page.goto(route.path);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('#main-content')).toHaveCount(1);
      const headingLevels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
      expect(headingLevels.filter((level) => level === 1)).toHaveLength(1);
      expect(headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1] + 1)).toBe(
        true,
      );
      if (route.path === '/budgets') {
        await expect(page.getByText('به ۸۰٪ بودجه رسیده‌اید.')).toBeVisible();
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        results.violations.map(({ id, impact, description, nodes }) => ({
          id,
          impact,
          description,
          elements: nodes.map(({ target, failureSummary, html }) => ({
            target,
            failureSummary,
            html,
          })),
        })),
        `${route.label} (${theme.name}) axe violations`,
      ).toEqual([]);
    }
  });
}

test('focuses main content after dashboard navigation and exposes skip navigation', async ({ page }) => {
  await installApiFixtures(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'رفتن به محتوای اصلی' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.locator('.sidebar-public-links a[href="/faq"]').click();
  await expect(page.getByRole('heading', { name: 'سؤالات متداول', exact: true })).toBeVisible();
  const mainContent = page.locator('#main-content');
  await expect(mainContent).toHaveCount(1);
  await expect(mainContent).toBeFocused();
});

test('keeps focus inside mobile navigation and restores it when closed', async ({ page }) => {
  await installApiFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const menuButton = page.getByRole('button', { name: 'بازکردن ناوبری' });
  await menuButton.click();

  const navigation = page.getByRole('navigation', { name: 'ناوبری اصلی' });
  const links = navigation.getByRole('link');
  await expect(links.first()).toBeFocused();
  await links.last().focus();
  await page.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(links.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
});

test('traps assistant dialog focus and restores the launcher on close', async ({ page }) => {
  await installApiFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const launcher = page.getByRole('button', { name: 'بازکردن راهنمای آسوده' });
  await launcher.click();

  const dialog = page.getByRole('dialog', { name: 'راهنمای آسوده' });
  const closeButton = dialog.getByRole('button', { name: 'بستن دستیار' });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeFocused();
});

test('associates invalid login and OTP fields with their error messages', async ({ page }) => {
  await installApiFixtures(page);
  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('invalid');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  const phone = page.getByLabel('شماره همراه');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`[id="${await phone.getAttribute('aria-describedby')}"]`)).toContainText(
    'شماره همراه ایرانی معتبر',
  );

  await page.addInitScript(() => {
    sessionStorage.setItem(
      'asoudeh.pendingOtp',
      JSON.stringify({
        phone: '09121234567',
        resendAvailableAt: Date.now() + 60_000,
        step: 'code',
      }),
    );
  });
  await page.goto('/verify-otp');
  await page.getByLabel('کد تأیید').fill('123');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();
  const otp = page.getByLabel('کد تأیید');
  await expect(otp).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(otp).toHaveAttribute('inputmode', 'numeric');
  await expect(otp).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`[id="${await otp.getAttribute('aria-describedby')}"]`)).toContainText(
    'کد تأیید باید شامل ۶ رقم باشد',
  );
});

test('associates dashboard form validation errors with the affected controls', async ({ page }) => {
  await installApiFixtures(page);

  await page.goto('/budgets');
  await page.getByLabel('سقف بودجه (تومان)').fill('0');
  await page.getByRole('button', { name: 'ثبت بودجه' }).click();
  const budgetAmount = page.getByLabel('سقف بودجه (تومان)');
  await expect(budgetAmount).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`#${await budgetAmount.getAttribute('aria-describedby')}`)).toContainText(
    'مبلغ بودجه باید بین',
  );

  await page.goto('/transactions');
  await page.getByLabel('مبلغ (تومان)').fill('0');
  await page.getByRole('button', { name: 'ادامه' }).click();
  const transactionAmount = page.getByLabel('مبلغ (تومان)');
  await expect(transactionAmount).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.locator(`#${await transactionAmount.getAttribute('aria-describedby')}`),
  ).toContainText('مبلغ باید بین');

  await page.goto('/caregiver');
  await page.getByLabel('شماره همراه مراقب').fill('09121234567');
  await page.getByRole('button', { name: 'ثبت دعوت' }).click();
  const permissions = page.getByRole('group', { name: 'انتخاب دسترسی‌ها' });
  await expect(permissions).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.locator(`#${await permissions.getAttribute('aria-describedby')}`),
  ).toContainText('حداقل یک سطح دسترسی');
});

test('keeps every targeted route within the viewport at a 200% zoom equivalent', async ({ page }) => {
  await installApiFixtures(page);
  await page.setViewportSize({ width: 640, height: 900 });
  for (const { path, otp } of pageRoutes) {
    if (otp) {
      await page.addInitScript(() => {
        sessionStorage.setItem(
          'asoudeh.pendingOtp',
          JSON.stringify({
            phone: '09121234567',
            resendAvailableAt: Date.now() + 60_000,
            step: 'code',
          }),
        );
      });
    }
    await page.goto(path);
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  }
});

test('renders Persian-only copy with no Arabic yeh/kaf or untranslated English', async ({ page }) => {
  await installApiFixtures(page);
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'asoudeh.pendingOtp',
      JSON.stringify({
        phone: '09121234567',
        resendAvailableAt: Date.now() + 60_000,
        step: 'code',
      }),
    );
  });

  for (const { path } of pageRoutes) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const userFacingText = await page.evaluate(() => {
      const body = document.body;
      const visibleText = body.innerText;
      const accessibleText = Array.from(
        body.querySelectorAll<HTMLElement>(
          '[aria-label], [aria-description], [placeholder], [title], img[alt]',
        ),
      )
        .filter((element) => element.getClientRects().length > 0)
        .map((element) =>
          [
            element.getAttribute('aria-label'),
            element.getAttribute('aria-description'),
            element.getAttribute('placeholder'),
            element.getAttribute('title'),
            element.getAttribute('alt'),
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(' ');
      return `${visibleText} ${accessibleText}`;
    });

    expect(userFacingText, `${path} contains Arabic yeh or kaf`).not.toMatch(/[يىك]/u);
    const untranslatedWords = userFacingText.match(/\b[A-Za-z]{3,}\b/g) ?? [];
    expect(
      untranslatedWords.filter((word) => !allowedLatinText.has(word)),
      `${path} contains untranslated English`,
    ).toEqual([]);
  }
});
