import { expect, test } from './diagnostics-test';

test('public information pages share navigation and are available without signing in', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const [path, heading] of [
    ['/', 'مدیریت مالی ساده و قابل اعتماد'],
    ['/terms', 'قوانین و مقررات'],
    ['/privacy', 'حریم خصوصی'],
    ['/faq', 'سؤالات متداول'],
    ['/about', 'درباره آسوده'],
    ['/contact', 'تماس با ما'],
    ['/guide', 'راهنمای استفاده'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    const headerLogo = page.locator('.public-brand img');
    await expect(headerLogo).toHaveAttribute('src', '/logo/asoudeh-horizontal.svg');
    await expect(headerLogo).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'پیوندهای صفحات عمومی' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ورود به آسوده' }).first()).toHaveAttribute(
      'href',
      '/login',
    );
    const title = await page.title();
    expect(title.match(/آسوده/g)).toHaveLength(1);
  }

  await page.goto('/contact');
  await expect(page.getByText('support@example.com')).toBeVisible();
  await expect(page.getByText('۰۰۰-۰۰۰-۰۰۰۰')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ارسال ایمیل به پشتیبانی' })).toHaveAttribute(
    'href',
    'mailto:support@example.com',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const mobileBrand = await page.locator('.public-brand img').boundingBox();
  expect(mobileBrand?.width).toBeLessThan(160);
  expect(mobileBrand?.x ?? -1).toBeGreaterThanOrEqual(0);
  await page.goto('/guide');
  await expect(page.getByRole('link', { name: 'ثبت تراکنش پس از ورود' })).toHaveAttribute(
    'href',
    '/transactions/new',
  );
  await expect(page.getByRole('link', { name: 'دیدن گزارش‌ها پس از ورود' })).toHaveAttribute(
    'href',
    '/reports',
  );
  expect(errors).toEqual([]);
});

test('public and authenticated page titles include the brand exactly once', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let data: Record<string, unknown> = {};
    if (path === '/me') {
      data = {
        profile: {
          id: 'title-check-user',
          accessibilitySettings: { fontScale: 1, highContrast: false },
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
    }
    await route.fulfill({ json: { success: true, data } });
  });

  for (const path of [
    '/',
    '/terms',
    '/privacy',
    '/faq',
    '/about',
    '/contact',
    '/guide',
    '/login',
    '/verify-otp',
    '/dashboard',
    '/transactions',
    '/budgets',
    '/reminders',
    '/reports',
    '/settings',
    '/categories',
    '/caregiver',
    '/welcome',
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title, `${path} title`).toContain('آسوده');
    expect(title.match(/آسوده/g), `${path} title`).toHaveLength(1);
  }
});

test('FAQ search filters answers and its accordion works with keyboard activation', async ({
  page,
}) => {
  await page.goto('/faq');
  const search = page.getByRole('searchbox', { name: 'جست‌وجو در پرسش‌ها و پاسخ‌ها' });
  await search.fill('یک‌بارمصرف');

  const matchingQuestion = page.getByRole('button', { name: /کد یک‌بارمصرف چه زمانی منقضی می‌شود/ });
  await expect(matchingQuestion).toBeVisible();
  await expect(page.getByRole('button', { name: /چطور درآمد یا هزینه ثبت کنم/ })).toHaveCount(0);

  await matchingQuestion.focus();
  await page.keyboard.press('Enter');
  await expect(matchingQuestion).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/پس از پنج دقیقه منقضی می‌شود/)).toBeVisible();

  await page.getByRole('button', { name: 'پاک‌کردن جست‌وجو' }).click();
  await expect(page.getByRole('button', { name: /چطور درآمد یا هزینه ثبت کنم/ })).toBeVisible();

  await search.fill('پرسشی که وجود ندارد');
  await expect(
    page.getByRole('status').filter({ hasText: 'پرسشی پیدا نشد' }),
  ).toContainText('پرسشی پیدا نشد');
});

test('content pages provide a navigable table of contents and mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy');

  const contents = page.getByText('فهرست مطالب', { exact: true });
  await contents.click();
  await expect(page.getByRole('link', { name: 'چه اطلاعاتی در حساب ثبت می‌شود؟' })).toBeVisible();
  await page.getByRole('link', { name: 'چه اطلاعاتی در حساب ثبت می‌شود؟' }).click();
  await expect(page).toHaveURL(/#collected-data$/);

  const mobileMenu = page.locator('.public-mobile-menu');
  await mobileMenu.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(mobileMenu).toHaveAttribute('open', '');
  await expect(mobileMenu.getByRole('link', { name: 'تماس با ما' })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('privacy and terms describe current SMS, assistant, cookie, storage, and deletion behavior', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByText(/SMS\.ir/)).toBeVisible();
  await expect(page.getByText(/ارائه‌دهنده هوش مصنوعی پیکربندی‌شده/)).toBeVisible();
  await expect(page.getByText(/HttpOnly/).first()).toBeVisible();
  await expect(page.getByText(/localStorage/)).toBeVisible();
  await expect(page.locator('main').getByText(/۳۰ روز/).first()).toBeVisible();

  await page.goto('/terms');
  await expect(page.getByText(/شماره همراه و کد یک‌بارمصرف به SMS\.ir/)).toBeVisible();
  await expect(page.getByText(/برای ۳۰ روز بعد زمان‌بندی می‌شود/)).toBeVisible();
});
