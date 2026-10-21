import { expect, test } from '@playwright/test';

const csrfToken = 'reports-caregiver-e2e-csrf-token';

test('shows a Jalali monthly report and loads the previous month', async ({ page }) => {
  const months: string[] = [];
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: '64b000000000000000000099',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/reports/monthly**', async (route) => {
    const month = new URL(route.request().url()).searchParams.get('month') ?? '';
    months.push(month);
    await route.fulfill({
      json: {
        success: true,
        data: {
          report: {
            monthKey: month,
            totals: { income: '200000', expenses: '75000', transactionCount: 3 },
            comparison: {
              previousMonthKey: '06-1405',
              previousExpenses: '100000',
              expenseChange: '-25000',
              expenseChangePercentage: -25,
            },
            expensesByCategory: [
              {
                categoryId: '64b000000000000000000001',
                categoryName: 'درمان',
                categoryIcon: 'wallet',
                amount: '75000',
                sharePercentage: 100,
              },
            ],
          },
        },
      },
    });
  });

  await page.goto('/reports');
  await expect(page.getByText('۲۰۰٬۰۰۰ تومان')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'جمع‌های ماهانه' }).getByText('۷۵٬۰۰۰ تومان'),
  ).toBeVisible();
  await expect(page.getByText('۱۰۰٪ هزینه‌ها صرف درمان شده است.')).toBeVisible();
  await expect(page.getByText(/۲۵٪ کمتر شده است/)).toBeVisible();
  await page.getByRole('button', { name: 'ماه قبل' }).click();
  await expect.poll(() => months.length).toBeGreaterThan(1);
  expect(months[0]).toMatch(/^\d{2}-\d{4}$/);
  expect(months[1]).not.toBe(months[0]);
});

test('invites, accepts, and revokes a caregiver with selected read-only permissions', async ({ page }) => {
  const linkId = '64b000000000000000000020';
  let links: Array<Record<string, unknown>> = [];
  let invitations: Array<Record<string, unknown>> = [{
    id: '64b000000000000000000021',
    seniorId: '64b000000000000000000022',
    caregiverPhone: '09120000001',
    seniorName: 'کاربر دعوت‌کننده',
    status: 'pending',
    permissions: ['VIEW_SUMMARY'],
  }];
  const seniors: Array<Record<string, unknown>> = [];

  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: '64b000000000000000000099',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken } } });
  });
  await page.route('**/api/v1/caregiver/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/links')) {
      await route.fulfill({ json: { success: true, data: { links } } });
      return;
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/invitations')) {
      await route.fulfill({ json: { success: true, data: { invitations } } });
      return;
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/seniors')) {
      await route.fulfill({ json: { success: true, data: { seniors } } });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/links')) {
      const body = request.postDataJSON() as { phone: string; permissions: string[] };
      links = [{
        id: linkId,
        seniorId: '64b000000000000000000023',
        caregiverPhone: body.phone,
        status: 'pending',
        permissions: body.permissions,
      }];
      await route.fulfill({
        status: 201,
        json: { success: true, data: { invitation: links[0] } },
      });
      return;
    }
    if (request.method() === 'PATCH' && url.pathname.endsWith(`/invitations/${invitations[0].id}`)) {
      invitations = [];
      await route.fulfill({ json: { success: true, data: { invitation: {} } } });
      return;
    }
    if (request.method() === 'DELETE' && url.pathname.endsWith(`/links/${linkId}`)) {
      links = [{ ...links[0], status: 'revoked' }];
      await route.fulfill({ json: { success: true, data: { link: links[0] } } });
      return;
    }
    await route.fulfill({ status: 404, json: { success: false } });
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/caregiver');
  await expect(page.getByText('کاربر دعوت‌کننده شما را به‌عنوان مراقب دعوت کرده است.')).toBeVisible();
  await page.getByLabel('شماره همراه مراقب').fill('09120000002');
  await page.getByLabel('مشاهدهٔ خلاصهٔ مالی').check();
  await page.getByRole('button', { name: 'ثبت دعوت' }).click();
  await expect(page.getByRole('status')).toContainText('دعوت ثبت شد');
  await expect(page.getByText('09120000002')).toBeVisible();

  await page.getByRole('button', { name: 'پذیرفتن' }).click();
  await expect(page.getByRole('status')).toContainText('دعوت پذیرفته شد');
  await expect(page.getByText('دعوت در انتظاری ندارید.')).toBeVisible();

  await page.getByRole('button', { name: 'لغو دسترسی' }).click();
  await expect(page.getByRole('status')).toContainText('دسترسی مراقب لغو شد');
  await expect(page.getByText('لغوشده')).toBeVisible();
});
