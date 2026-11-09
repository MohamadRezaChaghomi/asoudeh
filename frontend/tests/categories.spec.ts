import { expect, test } from './diagnostics-test';

const csrfToken = 'category-e2e-csrf-token';
const firstCategoryId = '64b000000000000000000101';
const addedCategoryId = '64b000000000000000000102';

test('lists, creates, edits, activates and deactivates categories in RTL; deletion stays unavailable', async ({
  page,
}) => {
  let categories = [
    {
      id: firstCategoryId,
      name: 'خوراک',
      type: 'expense',
      icon: 'wallet',
      isActive: true,
      isDefault: false,
    },
  ];
  let deletionRequests = 0;
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({ json: { success: true, data: { csrfToken } } }),
  );
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          profile: {
            id: 'category-test-user',
            accessibilitySettings: { fontScale: 1, highContrast: false },
          },
        },
      },
    }),
  );
  await page.route('**/api/v1/auth/activity', (route) =>
    route.fulfill({ json: { success: true, data: { active: true } } }),
  );
  await page.route('**/api/v1/categories**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (method === 'GET') {
      await route.fulfill({ json: { success: true, data: { categories } } });
      return;
    }
    if (method === 'POST') {
      const payload = route.request().postDataJSON() as { name: string; type: string };
      const category = {
        id: addedCategoryId,
        ...payload,
        icon: 'wallet',
        isActive: true,
        isDefault: false,
      };
      categories = [...categories, category];
      await route.fulfill({
        status: 201,
        json: { success: true, data: { category } },
      });
      return;
    }
    if (method === 'PATCH') {
      const id = url.pathname.split('/').at(-1);
      const payload = route.request().postDataJSON() as {
        name?: string;
        isActive?: boolean;
      };
      categories = categories.map((category) =>
        category.id === id ? { ...category, ...payload } : category,
      );
      await route.fulfill({
        json: {
          success: true,
          data: { category: categories.find((category) => category.id === id) },
        },
      });
      return;
    }
    if (method === 'DELETE') {
      deletionRequests += 1;
      await route.fulfill({
        status: 409,
        json: {
          success: false,
          error: { code: 'CATEGORY_DELETE_UNAVAILABLE', message: 'Unavailable' },
        },
      });
    }
  });

  await page.goto('/categories');
  await expect(page.getByRole('heading', { name: 'فهرست دسته‌بندی‌ها' })).toBeVisible();
  await expect(page.getByText('خوراک', { exact: true })).toBeVisible();
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  await expect(page.getByRole('note')).toContainText('حذف فیزیکی دسته‌بندی فعلاً در دسترس نیست');
  await expect(page.getByRole('button', { name: /حذف/ })).toHaveCount(0);

  await page.getByLabel('نام دسته‌بندی').fill('قبض‌ها');
  const typeSelect = page.getByLabel('نوع');
  await typeSelect.click();
  const typeListbox = page.getByRole('listbox');
  await expect(typeListbox).toBeVisible();
  await expect(typeListbox.getByRole('option', { name: 'هزینه' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(typeListbox.getByRole('option', { name: 'هزینه' }).locator('svg')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(typeListbox).toHaveCount(0);
  await expect(typeSelect).toBeFocused();

  await typeSelect.click();
  await page.getByRole('heading', { name: 'فهرست دسته‌بندی‌ها' }).click();
  await expect(typeListbox).toHaveCount(0);

  await typeSelect.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(typeSelect).toHaveAttribute('data-value', 'income');
  await typeSelect.click();
  await page.getByRole('option', { name: 'هزینه' }).click();
  await expect(typeSelect).toHaveAttribute('data-value', 'expense');
  await page.getByRole('button', { name: 'افزودن' }).click();
  await expect(page.getByText('قبض‌ها', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'دسته‌بندی با موفقیت اضافه شد' })).toContainText(
    'دسته‌بندی با موفقیت اضافه شد',
  );

  const addedCategory = page.locator('li').filter({ hasText: 'قبض‌ها' });
  await addedCategory.getByRole('button', { name: 'ویرایش' }).click();
  await page.getByLabel('نام جدید دسته‌بندی قبض‌ها').fill('هزینه‌های خانه');
  await addedCategory.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByText('هزینه‌های خانه', { exact: true })).toBeVisible();

  const editedCategory = page.locator('li').filter({ hasText: 'هزینه‌های خانه' });
  await editedCategory.getByRole('button', { name: 'غیرفعال‌کردن' }).click();
  await expect(editedCategory).toContainText('غیرفعال');
  await editedCategory.getByRole('button', { name: 'فعال‌کردن' }).click();
  await expect(editedCategory.getByRole('button', { name: 'غیرفعال‌کردن' })).toBeVisible();

  expect(deletionRequests).toBe(0);
  await expect(page.getByRole('button', { name: /حذف/ })).toHaveCount(0);
});
