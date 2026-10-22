'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { api, ensureCsrfToken } from '@/lib/api/client';

type CategoryType = 'income' | 'expense' | 'both';

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
}

interface ApiErrorBody {
  error?: { message?: string };
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
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
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
        setError(errorMessage(loadError));
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
    setNotice('');

    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 50) {
      setError('نام دسته‌بندی باید بین ۱ تا ۵۰ نویسه باشد.');
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
      setError(errorMessage(saveError));
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
      setError(errorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6">
        <PageSkeleton label="در حال بارگذاری دسته‌بندی‌ها…" variant="categories" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5">
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

        <form className="mt-7 grid gap-4 sm:grid-cols-[1fr_10rem_auto]" onSubmit={addCategory}>
          <div>
            <label className="mb-2 block font-medium" htmlFor="categoryName">نام دسته‌بندی</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              id="categoryName"
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <div>
            <label className="mb-2 block font-medium" htmlFor="categoryType">نوع</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-4"
              id="categoryType"
              onChange={(event) =>
                setType(event.target.value === 'income' ? 'income' : 'expense')
              }
              value={type}
            >
              <option value="expense">هزینه</option>
              <option value="income">درآمد</option>
            </select>
          </div>
          <button
            className="self-end rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            افزودن
          </button>
        </form>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">{notice}</p>}

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
                  {!category.isDefault && (
                    <button
                      className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-60"
                      disabled={saving}
                      onClick={() => void toggleCategory(category)}
                      type="button"
                    >
                      {category.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
