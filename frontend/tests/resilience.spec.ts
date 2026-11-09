import { expect, test } from './diagnostics-test';

async function mockSession(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'resilience-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    }),
  );
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({ json: { success: true, data: { csrfToken: 'resilience-csrf' } } }),
  );
  await page.route('**/api/v1/auth/activity', (route) =>
    route.fulfill({ json: { success: true, data: { active: true } } }),
  );
}

test('shows a friendly message and hides backend details after an API 500', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/dashboard**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'raw database password',
          stack: 'private stack trace',
        },
      }),
    }),
  );

  await page.goto('/dashboard');
  await expect(page.locator('section[role="alert"]')).toContainText(
    'سرویس موقتاً با مشکل روبه‌رو شده است',
  );
  await expect(page.getByText(/raw database password|private stack trace/)).toHaveCount(0);
});

test('shows a friendly offline message after an API network failure', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/dashboard**', (route) => route.abort('failed'));

  await page.goto('/dashboard');
  await expect(page.locator('section[role="alert"]')).toContainText(
    'ارتباط با سرور برقرار نشد',
  );
});

test('shows the Retry-After delay for a rate-limited API request', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/dashboard**', (route) =>
    route.fulfill({
      status: 429,
      headers: {
        'Retry-After': '12',
        'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'Retry-After',
      },
      json: { success: false, error: { code: 'RATE_LIMITED', message: 'raw limit details' } },
    }),
  );

  await page.goto('/dashboard');
  await expect(page.locator('section[role="alert"]')).toContainText('۱۲ ثانیه');
  await expect(page.getByText('raw limit details')).toHaveCount(0);
});

test('preserves the assistant question when sending fails', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/dashboard**', (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'private error' } },
    }),
  );
  await page.route('**/api/v1/assistant/status', (route) =>
    route.fulfill({ json: { success: true, data: { available: true } } }),
  );
  await page.route('**/api/v1/assistant/messages', (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'private error' } },
    }),
  );

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'بازکردن راهنمای آسوده' }).click();
  const input = page.getByLabel('پرسش شما');
  await expect(input).toBeEnabled();
  await input.fill('چطور بودجه ثبت کنم؟');
  await page.getByRole('button', { name: 'ارسال پرسش' }).click();

  await expect(input).toHaveValue('چطور بودجه ثبت کنم؟');
  await expect(page.locator('.assistant-message.is-error')).toContainText(
    'سرویس موقتاً با مشکل روبه‌رو شده است',
  );
});
