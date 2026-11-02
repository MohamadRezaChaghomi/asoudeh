import { expect, test } from '@playwright/test';

const profile = {
  id: 'assistant-test-user',
  displayName: 'کاربر آزمایشی',
  phone: '09121234567',
  birthYear: null,
  initialBalance: 0,
  accessibilitySettings: { fontScale: 1, highContrast: false },
};

test('keeps assistant unavailable until configured without inventing an AI reply', async ({
  page,
}) => {
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/assistant/status', async (route) => {
    await route.fulfill({ json: { success: true, data: { available: false } } });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'بازکردن راهنمای آسوده' }).click();

  await expect(page.getByRole('status')).toContainText('هنوز برای سامانه پیکربندی نشده است');
  await expect(page.getByLabel('پرسش شما')).toBeDisabled();
  await expect(page.locator('.assistant-message')).toHaveCount(0);
});

test('sends only an explicit question and renders provider output as plain text', async ({
  page,
}) => {
  let submittedMessage = '';
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({ json: { success: true, data: { profile } } });
  });
  await page.route('**/api/v1/assistant/status', async (route) => {
    await route.fulfill({ json: { success: true, data: { available: true } } });
  });
  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken: 'assistant-csrf-token' } } });
  });
  await page.route('**/api/v1/assistant/messages', async (route) => {
    submittedMessage = (route.request().postDataJSON() as { message: string }).message;
    await route.fulfill({
      json: {
        success: true,
        data: {
          answer: '<img src=x onerror=alert(1)> راهنمای ثبت هزینه',
          source: { label: 'راهنمای آسوده', href: '/guide' },
        },
      },
    });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'بازکردن راهنمای آسوده' }).click();
  const input = page.getByLabel('پرسش شما');
  await expect(input).toBeEnabled();
  await input.fill('هزینه را چگونه ثبت کنم؟');
  await page.getByRole('button', { name: 'ارسال پرسش' }).click();

  await expect(page.getByText('<img src=x onerror=alert(1)> راهنمای ثبت هزینه')).toBeVisible();
  expect(submittedMessage).toBe('هزینه را چگونه ثبت کنم؟');
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    submittedMessage,
  );
  await expect(page.locator('.assistant-transcript img')).toHaveCount(0);
});
