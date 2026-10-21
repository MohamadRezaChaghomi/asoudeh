import { expect, test } from '@playwright/test';

const csrfToken = 'budget-e2e-csrf-token';
const expenseCategory = {
  id: '64b000000000000000000001',
  name: 'خوراک',
  type: 'expense',
  icon: 'wallet',
  isActive: true,
  isDefault: false,
};

test('creates, edits, and deletes a monthly budget using live API responses', async ({ page }) => {
  let budget:
    | {
        id: string;
        categoryId: string;
        categoryName: string;
        categoryIcon: string;
        categoryIsActive: boolean;
        monthKey: string;
        limitAmount: number;
        spentAmount: string;
        remainingAmount: string;
        percentageUsed: number;
        status: 'normal' | 'warning' | 'exceeded';
      }
    | undefined;
  let requestedMonth = '';
  let createPayload: Record<string, unknown> | undefined;
  let updatePayload: Record<string, unknown> | undefined;

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken } } });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      json: { success: true, data: { categories: [expenseCategory] } },
    });
  });
  await page.route('**/api/v1/budgets**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      requestedMonth = new URL(request.url()).searchParams.get('month') ?? '';
      await route.fulfill({
        json: {
          success: true,
          data: {
            monthKey: requestedMonth,
            period: { startDate: '2026-09-23', endDateExclusive: '2026-10-23' },
            budgets: budget ? [budget] : [],
          },
        },
      });
      return;
    }

    if (request.method() === 'POST') {
      createPayload = request.postDataJSON() as Record<string, unknown>;
      budget = {
        id: '64b000000000000000000010',
        categoryId: expenseCategory.id,
        categoryName: expenseCategory.name,
        categoryIcon: expenseCategory.icon,
        categoryIsActive: true,
        monthKey: String(createPayload.monthKey),
        limitAmount: Number(createPayload.limitAmount),
        spentAmount: '85000',
        remainingAmount: '15000',
        percentageUsed: 85,
        status: 'warning',
      };
      await route.fulfill({
        status: 201,
        json: { success: true, data: { budget } },
      });
      return;
    }

    if (request.method() === 'PATCH') {
      updatePayload = request.postDataJSON() as Record<string, unknown>;
      const limitAmount = Number(updatePayload.limitAmount);
      budget = {
        ...budget!,
        limitAmount,
        remainingAmount: String(limitAmount - Number(budget!.spentAmount)),
        percentageUsed: Number(
          ((Number(budget!.spentAmount) / limitAmount) * 100).toFixed(1),
        ),
        status: 'normal',
      };
      await route.fulfill({ json: { success: true, data: { budget } } });
      return;
    }

    if (request.method() === 'DELETE') {
      budget = undefined;
      await route.fulfill({ json: { success: true, message: 'بودجه حذف شد.' } });
    }
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/budgets');
  await expect(page.getByText('برای این ماه هنوز بودجه‌ای ثبت نشده است.')).toBeVisible();
  await expect(page.getByLabel('دستهٔ هزینه')).toHaveValue(expenseCategory.id);
  await page.getByLabel('سقف بودجه (تومان)').fill('۱۰۰۰۰۰');
  await page.getByRole('button', { name: 'ثبت بودجه' }).click();

  await expect(page.getByRole('status')).toContainText('بودجه ثبت شد.');
  await expect(page.getByText('به ۸۰٪ بودجه رسیده‌اید.')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
  expect(requestedMonth).toMatch(/^\d{2}-\d{4}$/);
  expect(createPayload).toMatchObject({
    categoryId: expenseCategory.id,
    monthKey: requestedMonth,
    limitAmount: 100_000,
  });

  await page.getByRole('button', { name: 'ویرایش' }).click();
  await page.getByLabel('سقف بودجه (تومان)').fill('۲۰۰۰۰۰');
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات' }).click();
  await expect(page.getByRole('status')).toContainText('بودجه ویرایش شد.');
  await expect(page.getByText('مصرف بودجه در محدودهٔ عادی است.')).toBeVisible();
  expect(updatePayload).toMatchObject({ limitAmount: 200_000 });

  await page.getByRole('button', { name: 'حذف' }).click();
  await expect(page.getByRole('status')).toContainText('بودجه حذف شد.');
  await expect(page.getByText('برای این ماه هنوز بودجه‌ای ثبت نشده است.')).toBeVisible();
});
