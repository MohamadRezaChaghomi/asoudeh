'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { Select } from '@/components/ui/Select';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';

type CategoryType = 'income' | 'expense' | 'both';

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
}

function categoryTypeLabel(type: CategoryType): string {
  if (type === 'income') return 'درآمد';
  if (type === 'expense') return 'هزینه';
  return 'درآمد و هزینه';
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string>();
  const [editName, setEditName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<'name' | 'editName' | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const response = await api.get<{ success: true; data: { categories: Category[] } }>(
          '/categories',
        );
        if (active) setCategories(response.data.data.categories);
      } catch (loadError) {
        if (!active) return;
        if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(getApiErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCategories();
    return () => {
      active = false;
    };
  }, [router]);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldError(null);
    setNotice('');

    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 50) {
      setError('نام دسته‌بندی باید بین ۱ تا ۵۰ نویسه باشد.');
      setFieldError('name');
      return;
    }

    setSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.post<{
        success: true;
        data: { category: Category };
      }>('/categories', { name: normalizedName, type });
      setCategories((current) => [...current, response.data.data.category]);
      setName('');
      setNotice('دسته‌بندی با موفقیت اضافه شد.');
    } catch (saveError) {
      if (axios.isAxiosError(saveError) && saveError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: Category) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.patch<{
        success: true;
        data: { category: Category };
      }>(`/categories/${category.id}`, { isActive: !category.isActive });
      setCategories((current) =>
        current.map((item) =>
          item.id === category.id ? response.data.data.category : item,
        ),
      );
      setNotice(category.isActive ? 'دسته‌بندی غیرفعال شد.' : 'دسته‌بندی فعال شد.');
    } catch (updateError) {
      if (axios.isAxiosError(updateError) && updateError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>, category: Category) {
    event.preventDefault();
    const normalizedName = editName.trim();
    if (!normalizedName || normalizedName.length > 50) {
      setError('نام دسته‌بندی باید بین ۱ تا ۵۰ نویسه باشد.');
      setFieldError('editName');
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.patch<{
        success: true;
        data: { category: Category };
      }>(`/categories/${category.id}`, { name: normalizedName });
      setCategories((current) =>
        current.map((item) =>
          item.id === category.id ? response.data.data.category : item,
        ),
      );
      setEditingCategoryId(undefined);
      setNotice('دسته‌بندی با موفقیت ویرایش شد.');
    } catch (updateError) {
      if (axios.isAxiosError(updateError) && updateError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
        <PageSkeleton label="در حال بارگذاری دسته‌بندی‌ها…" variant="categories" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5" id="main-content" tabIndex={-1}>
      <section className="app-panel mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-muted text-sm">مدیریت اطلاعات مالی</p>
            <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">دسته‌بندی‌ها</h1>
            <p className="app-muted mt-2">دسته‌های درآمد و هزینهٔ حساب خود را مدیریت کنید.</p>
          </div>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/settings">
            بازگشت به تنظیمات
          </Link>
        </div>

        <form className="mt-7 grid gap-4 sm:grid-cols-[1fr_10rem_auto]" noValidate onSubmit={addCategory}>
          <div>
            <label className="mb-2 block font-medium" htmlFor="categoryName">نام دسته‌بندی</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              id="categoryName"
              maxLength={50}
              aria-invalid={fieldError === 'name'}
              aria-describedby={fieldError === 'name' ? 'category-field-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError(null);
              }}
              required
              value={name}
            />
          </div>
          <div>
            <label className="mb-2 block font-medium" htmlFor="categoryType">نوع</label>
            <Select
              id="categoryType"
              onChange={(value) => setType(value === 'income' ? 'income' : 'expense')}
              options={[
                { value: 'expense', label: 'هزینه' },
                { value: 'income', label: 'درآمد' },
              ]}
              value={type}
            />
          </div>
          <button
            className="self-end rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            افزودن
          </button>
        </form>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" id={fieldError ? 'category-field-error' : undefined} role="alert">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status" aria-live="polite" aria-atomic="true">{notice}</p>}

        <section className="mt-8" aria-labelledby="category-list-heading">
          <h2 className="text-xl font-bold text-asoudeh-navy" id="category-list-heading">
            فهرست دسته‌بندی‌ها
          </h2>
          <p className="app-muted mt-3 rounded-lg bg-amber-50 p-3 text-amber-950" role="note">
            حذف فیزیکی دسته‌بندی فعلاً در دسترس نیست؛ برای جلوگیری از آسیب به تراکنش‌های قبلی،
            دسته را می‌توانید غیرفعال کنید.
          </p>
          {categories.length === 0 ? (
            <p className="app-muted mt-4 rounded-lg bg-slate-50 p-4">
              هنوز دسته‌بندی‌ای ثبت نشده است. از فرم بالا یک دسته اضافه کنید.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {categories.map((category) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  key={category.id}
                >
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="app-muted mt-1 text-sm">
                      {categoryTypeLabel(category.type)}
                      {category.isDefault ? ' · پیش‌فرض سیستم' : ''}
                      {!category.isActive ? ' · غیرفعال' : ''}
                    </p>
                  </div>
                  {!category.isDefault && editingCategoryId === category.id ? (
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(event) => void saveCategory(event, category)}
                    >
                      <label className="sr-only" htmlFor={`edit-category-${category.id}`}>
                        نام جدید دسته‌بندی {category.name}
                      </label>
                      <input
                        className="rounded-lg border border-slate-300 bg-transparent px-3"
                        id={`edit-category-${category.id}`}
                        maxLength={50}
                        aria-invalid={fieldError === 'editName'}
                        aria-describedby={fieldError === 'editName' ? 'category-field-error' : undefined}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          setFieldError(null);
                        }}
                        required
                        value={editName}
                      />
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 font-medium disabled:opacity-60"
                        disabled={saving}
                        type="submit"
                      >
                        ذخیره
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 font-medium"
                        onClick={() => setEditingCategoryId(undefined)}
                        type="button"
                      >
                        انصراف
                      </button>
                    </form>
                  ) : !category.isDefault ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-60"
                        disabled={saving}
                        onClick={() => {
                          setEditName(category.name);
                          setEditingCategoryId(category.id);
                        }}
                        type="button"
                      >
                        ویرایش
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-60"
                        disabled={saving}
                        onClick={() => void toggleCategory(category)}
                        type="button"
                      >
                        {category.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
