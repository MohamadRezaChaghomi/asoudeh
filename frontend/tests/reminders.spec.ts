import { expect, test } from './diagnostics-test';
import { expectThemeAwareIllustration } from './assert-theme-aware-illustration';

const csrfToken = 'reminder-e2e-csrf-token';

test('keeps weekday labels separated at available calendar widths', async ({ page }) => {
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
  await page.route('**/api/v1/reminders**', async (route) => {
    await route.fulfill({
      json: { success: true, data: { monthKey: '07-1405', reminders: [] } },
    });
  });

  await page.goto('/reminders');
  await page.getByRole('button', { name: 'تغییر تاریخ' }).click();
  const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سررسید شمسی' });
  const weekdayHeaders = calendar.getByRole('grid').getByRole('row').first().getByRole('columnheader');

  for (const width of [323, 375, 480, 481, 640, 641, 768, 769, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const pickerWidth = await page.locator('.jalali-date-picker').evaluate((picker) =>
      picker.getBoundingClientRect().width,
    );
    const weekdayLayout = await weekdayHeaders.evaluateAll((headers) => {
      const labels = headers.map((header) => {
        const compact = header.querySelector<HTMLElement>('.jalali-calendar-weekday-compact')!;
        const full = header.querySelector<HTMLElement>('.jalali-calendar-weekday-full')!;
        const compactVisible = getComputedStyle(compact).display !== 'none';
        const label = compactVisible ? compact : full;
        const cellBounds = header.getBoundingClientRect();
        const labelBounds = label.getBoundingClientRect();
        return {
          cellLeft: cellBounds.left,
          cellRight: cellBounds.right,
          left: labelBounds.left,
          right: labelBounds.right,
          compactVisible,
        };
      });
      const labelsInVisualOrder = [...labels].sort((first, second) => first.left - second.left);
      return {
        allLabelsFit: labels.every(
          (item) => item.left >= item.cellLeft && item.right <= item.cellRight,
        ),
        labelsAreSeparated: labelsInVisualOrder.every(
          (item, index) => index === 0 || labelsInVisualOrder[index - 1].right + 2 <= item.left,
        ),
        compactVisible: labels[0].compactVisible,
      };
    });

    expect(weekdayLayout.allLabelsFit, `weekday labels fit at ${width}px`).toBe(true);
    expect(weekdayLayout.labelsAreSeparated, `weekday labels are separated at ${width}px`).toBe(true);
    expect(weekdayLayout.compactVisible, `weekday label style at ${width}px`).toBe(pickerWidth < 480);
  }
});

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
  await expect(page.getByText(/برای قبض یا پرداخت بعدی یادآور بسازید/)).toBeVisible();
  await expectThemeAwareIllustration(page, 'empty-reminders-illustration');
  await page.getByLabel('عنوان').fill('پرداخت قبض');
  await page.getByRole('button', { name: 'تغییر تاریخ' }).click();
  const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سررسید شمسی' });
  await expect(
    calendar.getByRole('grid').getByRole('columnheader').first(),
  ).toHaveAttribute('aria-label', 'شنبه');
  const initiallySelectedDate = await calendar.locator('[aria-pressed="true"]').getAttribute('data-date');
  const initiallyFocusedDate = await calendar.locator(':focus').getAttribute('data-date');
  await page.keyboard.press('ArrowLeft');
  const movedFocusedDate = await calendar.locator(':focus').getAttribute('data-date');
  expect(movedFocusedDate).not.toBe(initiallyFocusedDate);
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تغییر تاریخ' })).toBeFocused();
  await page.getByRole('button', { name: 'تغییر تاریخ' }).click();
  const reopenedCalendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سررسید شمسی' });
  await expect(reopenedCalendar.locator('[aria-pressed="true"]')).toHaveAttribute(
    'data-date',
    initiallySelectedDate ?? '',
  );
  const selectedDate = await reopenedCalendar.locator('[data-day="10"]').getAttribute('data-date');
  await reopenedCalendar.locator('[data-day="10"]').click();
  const reminderAmount = page.getByLabel('مبلغ (اختیاری، تومان)');
  await reminderAmount.pressSequentially('125000');
  await expect(reminderAmount).toHaveValue('۱۲۵٬۰۰۰');
  await page.getByLabel('تکرار').click();
  await page.getByRole('option', { name: 'ماهانه' }).click();
  await page.getByRole('button', { name: 'ثبت یادآور' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'یادآور ثبت شد.' })).toContainText(
    'یادآور ثبت شد.',
  );
  expect(createPayload).toMatchObject({
    title: 'پرداخت قبض',
    recurrence: 'monthly',
    amount: 125_000,
  });
  expect(createPayload?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(createPayload?.date).toBe(selectedDate);

  await page.getByRole('button', { name: 'ویرایش' }).click();
  await page.getByLabel('عنوان').fill('قبض برق');
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'یادآور ویرایش شد.' })).toContainText(
    'یادآور ویرایش شد.',
  );
  expect(updatePayload).toMatchObject({ title: 'قبض برق' });

  await page.getByRole('button', { name: 'انجام شد' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'یادآور این ماه انجام شد' })).toContainText(
    'یادآور این ماه انجام شد',
  );
  await expect(page.getByText(/وضعیت: انجام‌شده در این ماه/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'انجام شد' })).toHaveCount(0);

  await page.getByRole('button', { name: 'بایگانی' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'یادآور بایگانی شد.' })).toContainText(
    'یادآور بایگانی شد.',
  );
  await expect(page.getByText(/وضعیت: انجام‌شده در این ماه/)).toBeVisible();
});
