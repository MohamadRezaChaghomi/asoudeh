import { expect, test } from '@playwright/test';

const profile = {
  id: 'test-user',
  displayName: 'مریم آسوده',
  phone: '09121234567',
  birthYear: null,
  initialBalance: 0,
  accessibilitySettings: { fontScale: 1.25, highContrast: false },
};

test('validates the mobile number and completes OTP registration without storing tokens', async ({ page }) => {
  let otpRequests = 0;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    otpRequests += 1;
    await route.fulfill({
      json: { success: true, data: { developmentOtp: '123456' } },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: { registrationRequired: true, csrfToken: 'csrf-test-token' },
      },
    });
  });
  await page.route('**/api/v1/auth/register/complete', async (route) => {
    await route.fulfill({
      status: 201,
      json: { success: true, data: { profile, csrfToken: 'csrf-test-token' } },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('۰۸۱۲۱۲۳۴۵۶۷');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText('شماره همراه ایرانی معتبر');
  expect(otpRequests).toBe(0);

  await page.getByLabel('شماره همراه').fill('۰۹۱۲۱۲۳۴۵۶۷');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toBeVisible();
  await page.getByLabel('کد تأیید').fill('۱۲۳۴۵۶');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();

  await page.getByLabel('نام نمایشی').fill('مریم آسوده');
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'پروفایل و تنظیمات' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('accessToken');
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('refreshToken');
});

test('loads and updates profile accessibility preferences in Persian RTL', async ({ page }) => {
  let updatePayload: Record<string, unknown> | undefined;
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      json: { success: true, data: { csrfToken: 'csrf-test-token' } },
    });
  });
  await page.route('**/api/v1/me/profile', async (route) => {
    updatePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            ...profile,
            displayName: 'نام تازه',
            birthYear: 1340,
            initialBalance: 500000,
            accessibilitySettings: { fontScale: 1.5, highContrast: true },
          },
        },
      },
    });
  });

  await page.goto('/settings');
  await expect(page.getByLabel('نام نمایشی')).toHaveValue('مریم آسوده');
  await page.getByLabel('نام نمایشی').fill('نام تازه');
  await page.getByLabel('سال تولد شمسی (اختیاری)').fill('۱۳۴۰');
  await page.getByLabel('موجودی اولیه (تومان)').fill('۵۰۰۰۰۰');
  await page.getByLabel('اندازه متن').selectOption('1.5');
  await page.getByLabel('کنتراست بالا').check();
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click();

  await expect(page.getByRole('status')).toContainText('تغییرات با موفقیت ذخیره شد.');
  expect(updatePayload).toMatchObject({
    displayName: 'نام تازه',
    birthYear: 1340,
    initialBalance: 500000,
    accessibilitySettings: { fontScale: 1.5, highContrast: true },
  });
  await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');
  await expect(page.locator('html')).toHaveCSS('font-size', '24px');
});

test('refreshes an expired access session and retries the profile request', async ({ page }) => {
  let profileRequests = 0;
  let refreshRequests = 0;
  await page.route('**/api/v1/me', async (route) => {
    profileRequests += 1;
    if (profileRequests === 1) {
      await route.fulfill({
        status: 401,
        json: { success: false, error: { code: 'SESSION_EXPIRED', message: 'نشست منقضی شد.' } },
      });
      return;
    }
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      json: { success: true, data: { csrfToken: 'csrf-test-token' } },
    });
  });
  await page.route('**/api/v1/auth/refresh', async (route) => {
    refreshRequests += 1;
    await route.fulfill({
      json: { success: true, data: { refreshed: true, csrfToken: 'new-csrf-token' } },
    });
  });

  await page.goto('/settings');
  await expect(page.getByLabel('نام نمایشی')).toHaveValue('مریم آسوده');
  expect(profileRequests).toBe(2);
  expect(refreshRequests).toBe(1);
});
