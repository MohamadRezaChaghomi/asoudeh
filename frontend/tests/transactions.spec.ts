import { expect, test } from '@playwright/test';

const csrfToken = 'transaction-e2e-csrf-token';
let activeUserId = '64b000000000000000000099';
const expenseCategory = {
  id: '64b000000000000000000001',
  name: 'خوراک',
  type: 'expense',
  icon: 'wallet',
  isActive: true,
  isDefault: false,
};
const incomeCategory = {
  id: '64b000000000000000000002',
  name: 'حقوق',
  type: 'income',
  icon: 'wallet',
  isActive: true,
  isDefault: true,
};

test('creates an income through the three-step form with Persian amount and Jalali date', async ({
  page,
}) => {
  let transactions: Array<Record<string, unknown>> = [];
  let createPayload: Record<string, unknown> | undefined;
  const transactionId = '64b000000000000000000010';

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken } } });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: activeUserId,
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      json: { success: true, data: { categories: [expenseCategory, incomeCategory] } },
    });
  });
  await page.route('**/api/v1/transactions**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            transactions,
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: transactions.length,
              totalPages: transactions.length ? 1 : 0,
            },
          },
        },
      });
      return;
    }

    createPayload = route.request().postDataJSON() as Record<string, unknown>;
    transactions = [
      {
        id: transactionId,
        type: createPayload.type,
        amount: createPayload.amount,
        categoryId: incomeCategory.id,
        categoryName: incomeCategory.name,
        date: createPayload.date,
        note: createPayload.note ?? '',
      },
    ];
    await route.fulfill({
      status: 201,
      json: { success: true, data: { transaction: transactions[0] } },
    });
  });

  await page.goto('/transactions');
  await page.getByLabel('ذخیرهٔ موقت این پیش‌نویس در نشست فعلی مرورگر').check();
  const amount = page.getByLabel('مبلغ (تومان)');
  await amount.fill('۱۲۳۴۵۶');
  await expect(amount).toHaveValue(/۱۲۳[٬\u066c]۴۵۶/);
  await page.getByLabel('نوع').selectOption('income');
  await page.getByRole('button', { name: 'ادامه' }).click();

  const category = page.getByLabel('دسته‌بندی');
  await expect(category.locator('option')).toHaveText(['حقوق']);
  await expect(category).toHaveValue(incomeCategory.id);
  await page.locator('button[aria-pressed="true"]').click();
  expect(createPayload).toBeUndefined();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(
    page.getByRole('list', { name: 'مراحل ثبت تراکنش' }).getByRole('listitem').nth(2),
  ).toHaveAttribute('aria-current', 'step');
  expect(createPayload).toBeUndefined();
  await expect(page.getByText('۱۲۳٬۴۵۶ تومان')).toBeVisible();
  await expect(page.getByText('حقوق', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page.getByLabel('دسته‌بندی')).toHaveValue(incomeCategory.id);
  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page.getByLabel('نوع')).toHaveValue('income');
  await expect(page.getByLabel('مبلغ (تومان)')).toHaveValue(/۱۲۳[٬\u066c]۴۵۶/);

  await page.getByRole('button', { name: 'ادامه' }).click();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await page.getByLabel('توضیح (اختیاری)').fill('حقوق ماهانه');
  await page.getByRole('button', { name: 'ثبت تراکنش' }).click();

  await expect(page.getByRole('status')).toContainText('تراکنش ثبت شد.');
  await expect.poll(() =>
    page.evaluate(
      (key) => sessionStorage.getItem(key),
      `asoudeh.transactionDraft.v1.${activeUserId}`,
    ),
  ).toBeNull();
  expect(createPayload).toMatchObject({
    type: 'income',
    amount: 123456,
    categoryId: incomeCategory.id,
    note: 'حقوق ماهانه',
  });
  expect(createPayload?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText('حقوق', { exact: true }).last()).toBeVisible();
});

test('allows editing an existing transaction while retaining its inactive category', async ({
  page,
}) => {
  const inactiveCategory = {
    ...expenseCategory,
    name: 'دستهٔ غیرفعال',
    isActive: false,
  };
  const transaction = {
    id: '64b000000000000000000020',
    type: 'expense',
    amount: 4500,
    categoryId: inactiveCategory.id,
    categoryName: inactiveCategory.name,
    date: '2024-03-20',
    note: '',
  };
  let updatePayload: Record<string, unknown> | undefined;

  await page.route('**/api/v1/auth/csrf', async (route) => {
    await route.fulfill({ json: { success: true, data: { csrfToken } } });
  });
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: activeUserId,
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      json: { success: true, data: { categories: [inactiveCategory] } },
    });
  });
  await page.route('**/api/v1/transactions**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            transactions: [transaction],
            pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
          },
        },
      });
      return;
    }

    updatePayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: { success: true, data: { transaction: { ...transaction, ...updatePayload } } },
    });
  });

  await page.goto('/transactions');
  await page.getByRole('button', { name: 'ویرایش' }).click();
  await expect(page.getByLabel('مبلغ (تومان)')).toHaveValue('۴٬۵۰۰');
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page.getByLabel('دسته‌بندی')).toHaveValue(inactiveCategory.id);
  await expect(page.getByRole('button', { name: 'ادامه' })).toBeEnabled();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(
    page.getByRole('definition').filter({ hasText: inactiveCategory.name }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات' }).click();

  await expect(page.getByRole('status')).toContainText('تراکنش ویرایش شد.');
  expect(updatePayload).toMatchObject({
    type: 'expense',
    amount: 4500,
    categoryId: inactiveCategory.id,
    date: '2024-03-20',
  });
});

test('restores an opted-in draft only for the same authenticated account', async ({ page }) => {
  const firstAccountId = '64b000000000000000000099';
  activeUserId = firstAccountId;
  let createRequests = 0;
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: activeUserId,
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    });
  });
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      json: { success: true, data: { categories: [expenseCategory, incomeCategory] } },
    });
  });
  await page.route('**/api/v1/transactions**', async (route) => {
    if (route.request().method() === 'POST') createRequests += 1;
    await route.fulfill({
      json: {
        success: true,
        data: {
          transactions: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        },
      },
    });
  });

  await page.goto('/transactions');
  await page.getByLabel('ذخیرهٔ موقت این پیش‌نویس در نشست فعلی مرورگر').check();
  await page.getByLabel('نوع').selectOption('income');
  await page.getByLabel('مبلغ (تومان)').fill('۷۵۰۰۰');
  await page.getByRole('button', { name: 'ادامه' }).click();
  const firstAccountDraftKey = `asoudeh.transactionDraft.v1.${firstAccountId}`;
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), firstAccountDraftKey))
    .toContain('"amount":"۷۵٬۰۰۰"');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('پیش‌نویس محلی این حساب بازیابی شد');
  await expect(page.getByLabel('دسته‌بندی')).toHaveValue(incomeCategory.id);
  await expect(page.getByRole('list', { name: 'مراحل ثبت تراکنش' }).getByRole('listitem').nth(1))
    .toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'بازگشت' }).click();
  await expect(page.getByLabel('نوع')).toHaveValue('income');
  await expect(page.getByLabel('مبلغ (تومان)')).toHaveValue('۷۵٬۰۰۰');
  expect(createRequests).toBe(0);

  activeUserId = '64b000000000000000000098';
  await page.reload();
  await expect(page.getByLabel('نوع')).toHaveValue('expense');
  await expect(page.getByLabel('مبلغ (تومان)')).toHaveValue('');
  await expect(page.getByLabel('ذخیرهٔ موقت این پیش‌نویس در نشست فعلی مرورگر')).not.toBeChecked();

  activeUserId = firstAccountId;
  await page.reload();
  await expect(page.getByRole('status')).toContainText('پیش‌نویس محلی این حساب بازیابی شد');
  expect(createRequests).toBe(0);

  activeUserId = '64b000000000000000000098';
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ثبت تراکنش' })).toBeVisible();
  const accountBDraftKey = `asoudeh.transactionDraft.v1.${activeUserId}`;
  await page.evaluate(({ key, categoryId }) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        type: 'expense',
        amount: '۵۰۰۰',
        categoryId,
        date: '9999-99-99',
        note: '',
        step: 2,
      }),
    );
  }, { key: accountBDraftKey, categoryId: expenseCategory.id });
  expect(await page.evaluate((key) => sessionStorage.getItem(key), accountBDraftKey))
    .toContain('"date":"9999-99-99"');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ثبت تراکنش' })).toBeVisible();
  await expect.poll(() =>
    page.evaluate((key) => sessionStorage.getItem(key), accountBDraftKey),
  ).toBeNull();
  await expect(page.getByText('پیش‌نویس ذخیره‌شده معتبر نبود و حذف شد.', { exact: true }))
    .toBeVisible();
  await expect(page.getByLabel('نوع')).toHaveValue('expense');
  await expect(page.getByLabel('مبلغ (تومان)')).toHaveValue('');
});

test('redirects the legacy new-transaction route to the implemented form', async ({ page }) => {
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
  await page.route('**/api/v1/categories', async (route) => {
    await route.fulfill({
      json: { success: true, data: { categories: [expenseCategory, incomeCategory] } },
    });
  });
  await page.route('**/api/v1/transactions**', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          transactions: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        },
      },
    });
  });

  await page.goto('/transactions/new');
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole('heading', { name: 'ثبت تراکنش' })).toBeVisible();
});
