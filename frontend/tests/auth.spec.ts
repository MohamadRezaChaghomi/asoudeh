import { expect, test } from '@playwright/test';

const profile = {
  id: 'test-user',
  displayName: 'مریم آسوده',
  phone: '09121234567',
  birthYear: null,
  initialBalance: 0,
  accessibilitySettings: { fontScale: 1.25, highContrast: false },
};

test('uses the development quick-login phone without showing the OTP form', async ({ page }) => {
  let verificationPayload: Record<string, string> | undefined;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ phone: '09120000000' });
    await route.fulfill({
      json: {
        success: true,
        data: {
          developmentOtp: '123456',
          developmentQuickLogin: true,
          resendAfterSeconds: 60,
        },
      },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    verificationPayload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      json: {
        success: true,
        data: { registrationRequired: false, csrfToken: 'quick-login-csrf' },
      },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: { ...profile, phone: '09120000000' },
        },
      },
    });
  });

  await page.goto('/login');
  await expect(page.getByLabel('شماره همراه')).toHaveValue('09120000000');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByLabel('کد تأیید')).toHaveCount(0);
  expect(verificationPayload).toEqual({ phone: '09120000000', code: '123456' });
});

test('sends first-time quick-login users to registration without requesting code entry', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          developmentOtp: '123456',
          developmentQuickLogin: true,
          resendAfterSeconds: 60,
        },
      },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      phone: '09120000000',
      code: '123456',
    });
    await route.fulfill({
      json: {
        success: true,
        data: { registrationRequired: true, csrfToken: 'registration-csrf' },
      },
    });
  });

  await page.goto('/login');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByLabel('نام نمایشی')).toBeVisible();
  await expect(page.getByLabel('کد تأیید')).toHaveCount(0);
});

test('navigates to the OTP verification route after the request is accepted', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      json: {
        success: true,
        data: { message: 'درخواست پذیرفته شد.', resendAfterSeconds: 60 },
      },
    });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  const submitButton = page.locator('form button[type="submit"]');
  const submit = submitButton.click();
  await expect(submitButton).toBeDisabled();
  await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await submit;

  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  expect(requestCount).toBe(1);
});

test('returns to login when the OTP route has no pending request', async ({ page }) => {
  await page.goto('/verify-otp');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('شماره همراه')).toBeVisible();
});

test('preserves the pending OTP challenge safely across a refresh', async ({ page }) => {
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          developmentOtp: '123456',
          resendAfterSeconds: 60,
        },
      },
    });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByRole('button', { name: /ارسال دوباره کد/ })).toBeDisabled();

  await page.reload();

  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toBeVisible();
  await expect(page.getByText(/0912••••567/)).toBeVisible();
});

test('shows API errors and allows retry when requesting an OTP fails', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          error: { code: 'OTP_DELIVERY_UNAVAILABLE', message: 'ارسال کد در دسترس نیست.' },
        },
      });
      return;
    }

    await route.fulfill({
      json: { success: true, data: { resendAfterSeconds: 60 } },
    });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('ارسال کد در دسترس نیست.');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  expect(requests).toBe(2);
});

test('recovers from a network failure without leaving the login form disabled', async ({ page }) => {
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.abort('failed');
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();

  await expect(page.locator('p[role="alert"]')).toContainText('ارتباط با سرور برقرار نشد');
  await expect(page.getByRole('button', { name: 'دریافت کد تأیید' })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
});

test('rejects an invalid OTP without authenticating or leaving the verification route', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({ json: { success: true, data: { resendAfterSeconds: 60 } } });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    await route.fulfill({
      status: 400,
      json: {
        success: false,
        error: { code: 'OTP_INVALID', message: 'کد تأیید معتبر نیست یا منقضی شده است.' },
      },
    });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await page.getByLabel('کد تأیید').fill('000000');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.locator('p[role="alert"]')).toContainText('کد تأیید معتبر نیست');
});

test('navigates to the protected app only after the backend confirms OTP verification', async ({
  page,
}) => {
  let verificationPayload: Record<string, string> | undefined;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({
      json: { success: true, data: { developmentOtp: '123456', resendAfterSeconds: 60 } },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    verificationPayload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      json: {
        success: true,
        data: { registrationRequired: false, csrfToken: 'session-csrf-token' },
      },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill(profile.phone);
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  await page.getByLabel('کد تأیید').fill('123456');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'پروفایل و تنظیمات' })).toBeVisible();
  expect(verificationPayload).toEqual({ phone: profile.phone, code: '123456' });
});

test('validates the mobile number and completes OTP registration without storing tokens', async ({ page }) => {
  let verificationPayload: Record<string, string> | undefined;
  let otpRequests = 0;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    otpRequests += 1;
    await route.fulfill({
      json: { success: true, data: { developmentOtp: '123456' } },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    verificationPayload = route.request().postDataJSON() as Record<string, string>;
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
  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toBeVisible();
  await page.getByLabel('کد تأیید').fill('۱۲۳۴۵۶');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();
  expect(verificationPayload).toEqual({ phone: '09121234567', code: '123456' });

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

test('applies saved accessibility preferences across dashboard reloads and resets on public navigation', async ({
  page,
}) => {
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            ...profile,
            accessibilitySettings: { fontScale: 1.5, highContrast: true },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/reports/monthly**', async (route) => {
    const month = new URL(route.request().url()).searchParams.get('month') ?? '01-1405';
    await route.fulfill({
      json: {
        success: true,
        data: {
          report: {
            monthKey: month,
            totals: { income: '0', expenses: '0', transactionCount: 0 },
            comparison: {
              previousMonthKey: '12-1404',
              previousExpenses: '0',
              expenseChange: '0',
              expenseChangePercentage: null,
            },
            expensesByCategory: [],
          },
        },
      },
    });
  });

  await page.goto('/reports');
  await expect.poll(() =>
    page.evaluate(() => ({
      fontSize: getComputedStyle(document.documentElement).fontSize,
      highContrast: document.documentElement.dataset.highContrast,
    })),
  ).toEqual({ fontSize: '24px', highContrast: 'true' });
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => getComputedStyle(document.activeElement!).outlineColor),
  ).toBe('rgb(255, 255, 0)');

  await page.reload();
  await expect.poll(() =>
    page.evaluate(() => ({
      fontSize: getComputedStyle(document.documentElement).fontSize,
      highContrast: document.documentElement.dataset.highContrast,
    })),
  ).toEqual({ fontSize: '24px', highContrast: 'true' });

  await page.goto('/login');
  await expect.poll(() =>
    page.evaluate(() => ({
      fontSize: getComputedStyle(document.documentElement).fontSize,
      highContrast: document.documentElement.dataset.highContrast,
    })),
  ).toEqual({ fontSize: '16px', highContrast: undefined });
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

test('requires OTP and explicit confirmation before scheduling account deletion', async ({
  page,
}) => {
  let deletionCode = '';
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      json: { success: true, data: { csrfToken: 'deletion-csrf-token' } },
    });
  });
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ phone: profile.phone });
    await route.fulfill({
      json: { success: true, data: { developmentOtp: '123456' } },
    });
  });
  await page.route('**/api/v1/auth/account-deletion', async (route) => {
    deletionCode = (route.request().postDataJSON() as { code: string }).code;
    await route.fulfill({
      json: {
        success: true,
        data: { scheduledFor: '2026-11-20T00:00:00.000Z' },
        message: 'درخواست حذف ثبت شد؛ دسترسی حساب فوراً بسته و داده‌ها پس از ۳۰ روز پاک می‌شوند.',
      },
    });
  });

  await page.goto('/settings');
  await page.getByRole('button', { name: 'ارسال کد تأیید به شماره حساب' }).click();
  await expect(page.getByRole('status')).toContainText('123456');
  const confirmButton = page.getByRole('button', { name: 'تأیید حذف حساب' });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel('کد تأیید شش‌رقمی').fill('۱۲۳۴۵۶');
  await page.getByLabel(/می‌دانم دسترسی فوراً بسته می‌شود/).check();
  await expect(confirmButton).toBeEnabled();
  const deletionRequest = page.waitForRequest('**/api/v1/auth/account-deletion');
  await confirmButton.click();
  await deletionRequest;

  await expect.poll(() => deletionCode).toBe('123456');
  await expect(page).toHaveURL(/\/login$/);
});
