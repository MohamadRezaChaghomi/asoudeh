import { expect, test } from '@playwright/test';

const csrfToken = 'reminder-e2e-csrf-token';

test('creates, completes, and archives a monthly reminder while showing persisted status', async ({
  page,
}) => {
  let reminder:
    | {
        id: string;
        title: string;
        date: string;
        nextDueDate: string;
        recurrence: 'none' | 'monthly' | 'yearly';
        amount?: number;
        isActive: boolean;
        isCompleted: boolean;
      }
    | undefined;
  let createPayload: Record<string, unknown> | undefined;
  let updatePayload: Record<string, unknown> | undefined;
  const reminderId = '64b000000000000000000040';

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken } } });
  });
  await page.route('**/api/v1/reminders**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            monthKey: '07-1405',
            reminders: reminder ? [reminder] : [],
          },
        },
      });
      return;
    }
    if (request.method() === 'POST' && request.url().endsWith('/complete')) {
      reminder = { ...reminder!, isCompleted: true };
      await route.fulfill({
        json: {
          success: true,
          data: {
            completion: {
              id: '64b000000000000000000041',
              reminderId,
              monthKey: '07-1405',
              completedAt: '2026-10-21T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }
    if (request.method() === 'POST') {
      createPayload = request.postDataJSON() as Record<string, unknown>;
      reminder = {
        id: reminderId,
        title: String(createPayload.title),
        date: String(createPayload.date),
        nextDueDate: String(createPayload.date),
        recurrence: createPayload.recurrence as 'monthly' | 'none',
        amount: Number(createPayload.amount),
        isActive: true,
        isCompleted: false,
      };
      await route.fulfill({
        status: 201,
        json: { success: true, data: { reminder } },
      });
      return;
    }
    if (request.method() === 'PATCH') {
      updatePayload = request.postDataJSON() as Record<string, unknown>;
      reminder = {
        ...reminder!,
        title: String(updatePayload.title),
        amount: Number(updatePayload.amount),
      };
      await route.fulfill({ json: { success: true, data: { reminder } } });
      return;
    }
    if (request.method() === 'DELETE') {
      reminder = { ...reminder!, isActive: false };
      await route.fulfill({ json: { success: true, message: 'یادآور بایگانی شد.' } });
    }
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/reminders');
  await expect(page.getByText(/هنوز یادآوری ثبت نکرده‌اید/)).toBeVisible();
  await page.getByLabel('عنوان').fill('پرداخت قبض');
  await page.getByLabel('روز').selectOption('10');
  await page.getByLabel('مبلغ (اختیاری، تومان)').fill('۱۲۵۰۰۰');
  await page.getByLabel('تکرار').selectOption('monthly');
  await page.getByRole('button', { name: 'ثبت یادآور' }).click();

  await expect(page.getByRole('status')).toContainText('یادآور ثبت شد.');
  expect(createPayload).toMatchObject({
    title: 'پرداخت قبض',
    recurrence: 'monthly',
    amount: 125_000,
  });
  expect(createPayload?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await page.getByRole('button', { name: 'ویرایش' }).click();
  await page.getByLabel('عنوان').fill('قبض برق');
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات' }).click();
  await expect(page.getByRole('status')).toContainText('یادآور ویرایش شد.');
  expect(updatePayload).toMatchObject({ title: 'قبض برق' });

  await page.getByRole('button', { name: 'انجام شد' }).click();
  await expect(page.getByRole('status')).toContainText('یادآور این ماه انجام شد');
  await expect(page.getByText(/وضعیت: انجام‌شده در این ماه/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'انجام شد' })).toHaveCount(0);

  await page.getByRole('button', { name: 'بایگانی' }).click();
  await expect(page.getByRole('status')).toContainText('یادآور بایگانی شد.');
  await expect(page.getByText(/وضعیت: انجام‌شده در این ماه/)).toBeVisible();
});
