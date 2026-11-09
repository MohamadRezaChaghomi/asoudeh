import { expect, test } from './diagnostics-test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({
      json: { success: true, data: { csrfToken: 'test-csrf-token' } },
    });
  });
});

const profile = {
  id: 'test-user',
  displayName: 'مریم آسوده',
  phone: '09121234567',
  birthYear: null,
  initialBalance: 0,
  accessibilitySettings: { fontScale: 1.25, highContrast: false },
};

test('shows the symbol mark on login and OTP registration without duplicating the brand name', async ({
  page,
}) => {
  await page.goto('/login');
  const loginLogo = page.getByRole('img', { name: 'نشان آسوده' });
  await expect(loginLogo).toBeVisible();
  await expect(loginLogo).toHaveAttribute('src', '/logo/asoudeh-symbol.svg');
  const loginLogoWidth = await loginLogo.evaluate(
    (image: HTMLImageElement) => image.naturalWidth,
  );
  expect(loginLogoWidth).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible();
  const [logoBounds, backBounds] = await Promise.all([
    loginLogo.boundingBox(),
    page.getByRole('button', { name: 'بازگشت' }).boundingBox(),
  ]);
  expect(logoBounds?.width).toBeGreaterThanOrEqual(56);
  expect(logoBounds?.width).toBe(56);
  expect(backBounds?.height).toBeGreaterThanOrEqual(44);
  expect(backBounds?.x ?? Infinity).toBeLessThan(logoBounds?.x ?? 0);
  expect(backBounds?.x ?? Infinity).toBeLessThan((logoBounds?.x ?? 0) + (logoBounds?.width ?? 0) / 2);
  expect(
    logoBounds &&
      backBounds &&
      logoBounds.x < backBounds.x + backBounds.width &&
      logoBounds.x + logoBounds.width > backBounds.x &&
      logoBounds.y < backBounds.y + backBounds.height &&
      logoBounds.y + logoBounds.height > backBounds.y,
  ).toBe(false);
  await expect(loginLogo.locator('xpath=..')).toHaveCSS('border-width', '0px');

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
  await page.goto('/verify-otp');
  const verificationLogo = page.getByRole('img', { name: 'نشان آسوده' });
  await expect(verificationLogo).toBeVisible();
  await expect(verificationLogo).toHaveAttribute('src', '/logo/asoudeh-symbol.svg');
  await expect
    .poll(() => verificationLogo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'ساخت حساب کاربری' })).toBeVisible();
  const [verificationLogoBounds, verificationBackBounds] = await Promise.all([
    verificationLogo.boundingBox(),
    page.getByRole('button', { name: 'بازگشت' }).boundingBox(),
  ]);
  expect(verificationLogoBounds?.width).toBe(56);
  expect(verificationBackBounds?.height).toBeGreaterThanOrEqual(44);
  expect(verificationBackBounds?.x ?? Infinity).toBeLessThan(verificationLogoBounds?.x ?? 0);
  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('شماره همراه')).toBeVisible();
});

test('returns from login to the public home page', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /مدیریت مالی/ })).toBeVisible();
});

test('uses the system theme by default and preserves a pre-login theme choice after login', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({ json: { success: true, data: { resendAfterSeconds: 60 } } });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    await route.fulfill({
      json: { success: true, data: { registrationRequired: false, csrfToken: 'login-theme-csrf' } },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/dashboard', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
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
        },
      },
    });
  });
  await page.route('**/api/v1/auth/activity', async (route) => {
    await route.fulfill({ json: { success: true, data: { active: true } } });
  });

  await page.goto('/login');
  const themeToggle = page.getByRole('button', { name: 'فعال‌کردن پوسته روشن' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const toggleBounds = await themeToggle.boundingBox();
  expect(toggleBounds?.width).toBeGreaterThanOrEqual(44);
  expect(toggleBounds?.height).toBeGreaterThanOrEqual(44);
  await themeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('asoudeh.theme'))).toBe('light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('شماره همراه').fill(profile.phone);
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await page.getByLabel('کد تأیید').fill('123456');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.goto('/settings');
  const settingsThemeToggle = page.getByRole('button', { name: 'فعال‌کردن پوسته تیره' });
  await expect(settingsThemeToggle).toBeVisible();
  await settingsThemeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('asoudeh.theme'))).toBe('dark');
});

test('requires manual OTP entry and never returns or stores the development OTP', async ({
  page,
}) => {
  let verificationPayload: Record<string, string> | undefined;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
    expect(route.request().postDataJSON()).toEqual({ phone: profile.phone });
    await route.fulfill({
      json: { success: true, data: { resendAfterSeconds: 60 } },
    });
  });
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
    verificationPayload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      json: { success: true, data: { registrationRequired: false } },
    });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/dashboard', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
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
        },
      },
    });
  });
  await page.goto('/login');
  await expect(page.getByLabel('شماره همراه')).toHaveValue('');
  await page.getByLabel('شماره همراه').fill(profile.phone);
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByText('کد تا ۵ دقیقه معتبر است.')).toBeVisible();
  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toHaveCount(0);
  const storage = await page.evaluate(() => ({
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
    pendingFlow: JSON.parse(sessionStorage.getItem('asoudeh.pendingOtp') ?? 'null'),
  }));
  expect(storage.localStorageKeys).toEqual([]);
  expect(storage.sessionStorageKeys).toContain('asoudeh.pendingOtp');
  expect(Object.keys(storage.pendingFlow).sort()).toEqual([
    'phone',
    'resendAvailableAt',
    'step',
  ]);
  expect(storage.pendingFlow).not.toHaveProperty('code');
  const pendingFlow = JSON.parse(
    (await page.evaluate(() => sessionStorage.getItem('asoudeh.pendingOtp'))) ?? 'null',
  ) as Record<string, unknown>;
  expect(pendingFlow).not.toHaveProperty('code');
  expect(pendingFlow).not.toHaveProperty('developmentOtp');
  await page.getByLabel('کد تأیید').fill('123456');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
  expect(verificationPayload).toEqual({ phone: profile.phone, code: '123456' });
});

test('navigates to the OTP verification route after the request is accepted', async ({ page }) => {
  let requestCount = 0;
  let releaseRequest!: () => void;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    requestCount += 1;
    expect(route.request().headers()['x-csrf-token']).toBe('test-csrf-token');
    await requestGate;
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
  expect(requestCount).toBe(1);
  releaseRequest();
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

test('preserves only the phone and resend time across refresh, never the OTP', async ({ page }) => {
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: { resendAfterSeconds: 60 },
      },
    });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('09121234567');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByRole('button', { name: /ارسال دوباره کد/ })).toBeDisabled();
  const pendingFlow = JSON.parse(
    (await page.evaluate(() => sessionStorage.getItem('asoudeh.pendingOtp'))) ?? 'null',
  ) as Record<string, unknown>;
  expect(pendingFlow).not.toHaveProperty('code');
  expect(pendingFlow).not.toHaveProperty('developmentOtp');

  await page.reload();

  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toHaveCount(0);
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
  await expect(page.locator('p[role="alert"]')).toContainText(
    'سرویس موقتاً با مشکل روبه‌رو شده است',
  );
  await expect(page.getByText('ارسال کد در دسترس نیست.')).toHaveCount(0);
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

test('keeps browser errors clear after confirmed OTP login', async ({ page }) => {
  let verificationPayload: Record<string, string> | undefined;
  let csrfRequests = 0;
  let profileRequests = 0;
  let dashboardRequests = 0;
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.startsWith('/api/v1/')) {
      browserErrors.push(`${request.method()} ${requestUrl.pathname} failed`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      browserErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    csrfRequests += 1;
    await route.fulfill({
      json: { success: true, data: { csrfToken: 'login-regression-csrf-token' } },
    });
  });
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    await route.fulfill({
      json: { success: true, data: { resendAfterSeconds: 60 } },
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
    profileRequests += 1;
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/dashboard', async (route) => {
    dashboardRequests += 1;
    await route.fulfill({
      json: {
        success: true,
        data: {
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
        },
      },
    });
  });
  await page.route('**/api/v1/auth/activity', async (route) => {
    await route.fulfill({ json: { success: true, data: { active: true } } });
  });
  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill(profile.phone);
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  await page.getByLabel('کد تأیید').fill('123456');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
  await expect.poll(() => profileRequests).toBe(1);
  await expect.poll(() => dashboardRequests).toBeGreaterThan(0);
  expect(csrfRequests).toBe(1);
  await page.waitForTimeout(3000);
  expect(browserErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'خوش آمدید' })).toHaveCount(0);
  expect(verificationPayload).toEqual({ phone: profile.phone, code: '123456' });
});

test('validates the mobile number and completes OTP registration without storing tokens', async ({ page }) => {
  let verificationPayload: Record<string, string> | undefined;
  let otpRequests = 0;
  await page.route('**/api/v1/auth/otp/request', async (route) => {
    otpRequests += 1;
    await route.fulfill({
      json: { success: true, data: {} },
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
  await page.route('**/api/v1/dashboard', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
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
        },
      },
    });
  });
  await page.route('**/api/v1/auth/activity', async (route) => {
    await route.fulfill({ json: { success: true, data: {} } });
  });

  await page.goto('/login');
  await page.getByLabel('شماره همراه').fill('۰۸۱۲۱۲۳۴۵۶۷');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText('شماره همراه ایرانی معتبر');
  expect(otpRequests).toBe(0);

  await page.getByLabel('شماره همراه').fill('۰۹۱۲۱۲۳۴۵۶۷');
  await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByText('کد شبیه‌ساز توسعه:')).toHaveCount(0);
  await page.getByLabel('کد تأیید').fill('۱۲۳۴۵۶');
  await page.getByRole('button', { name: 'تأیید و ادامه' }).click();
  expect(verificationPayload).toEqual({ phone: '09121234567', code: '123456' });

  await page.getByLabel('نام نمایشی').fill('مریم آسوده');
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible();
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
  await page.getByLabel('اندازه متن').click();
  await page.getByRole('option', { name: '۱۵۰٪' }).click();
  await page.getByLabel('کنتراست بالا').check();
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'تغییرات با موفقیت ذخیره شد.' }),
  ).toContainText('تغییرات با موفقیت ذخیره شد.');
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
      json: { success: true, data: {} },
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
  const deletionStatus = page
    .getByRole('status')
    .filter({ hasText: 'کد تأیید به شماره همراه حساب ارسال می‌شود' });
  await expect(deletionStatus).toContainText('کد تأیید به شماره همراه حساب ارسال می‌شود');
  await expect(deletionStatus).not.toContainText('123456');
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
