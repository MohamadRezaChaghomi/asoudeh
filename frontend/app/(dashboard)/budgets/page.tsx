'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getJalaliParts, getTehranTodayIso, jalaliToGregorianIso } from '@/lib/jalaliDate';

type CategoryType = 'income' | 'expense' | 'both';

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  isActive: boolean;
  isDefault: boolean;
}

interface Budget {
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

interface BudgetMonth {
  monthKey: string;
  period: { startDate: string; endDateExclusive: string };
  budgets: Budget[];
}

interface ApiErrorBody {
  error?: { message?: string };
}

const MAX_BUDGET_AMOUNT = 1_000_000_000_000;

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

function formatAmount(amount: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(BigInt(amount));
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - '٠'.charCodeAt(0)));
}

function formatAmountInput(value: string): string {
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('fa-IR').format(BigInt(digits));
}

function currentMonthKey(): string {
  const { year, month } = getJalaliParts(getTehranTodayIso());
  return `${String(month).padStart(2, '0')}-${year}`;
}

function shiftMonth(monthKey: string, amount: -1 | 1): string {
  const [monthText, yearText] = monthKey.split('-');
  let month = Number(monthText) + amount;
  let year = Number(yearText);
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  return year < 1200 || year > 1600
    ? monthKey
    : `${String(month).padStart(2, '0')}-${year}`;
}

function monthLabel(monthKey: string): string {
  const [month, year] = monthKey.split('-').map(Number);
  const firstDay = jalaliToGregorianIso({ year, month, day: 1 });
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${firstDay}T00:00:00.000Z`));
}

function percentageLabel(value: number): string {
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value)}٪`;
}

export default function BudgetsPage() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [monthData, setMonthData] = useState<BudgetMonth>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [editingBudget, setEditingBudget] = useState<Budget>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeExpenseCategories = categories.filter(
    (category) => !category.isDefault && category.isActive && category.type === 'expense',
  );

  const refreshBudgets = useCallback(async () => {
    const response = await api.get<{ success: true; data: BudgetMonth }>('/budgets', {
      params: { month: monthKey },
    });
    setMonthData(response.data.data);
  }, [monthKey]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [budgetResponse, categoryResponse] = await Promise.all([
          api.get<{ success: true; data: BudgetMonth }>('/budgets', {
            params: { month: monthKey },
          }),
          api.get<{ success: true; data: { categories: Category[] } }>('/categories'),
        ]);
        if (!active) return;
        setMonthData(budgetResponse.data.data);
        setCategories(categoryResponse.data.data.categories);
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

    void loadData();
    return () => {
      active = false;
    };
  }, [monthKey, router]);

  useEffect(() => {
    if (
      !editingBudget &&
      !activeExpenseCategories.some((category) => category.id === categoryId)
    ) {
      setCategoryId(activeExpenseCategories[0]?.id ?? '');
    }
  }, [activeExpenseCategories, categoryId, editingBudget]);

  function resetForm() {
    setEditingBudget(undefined);
    setLimitAmount('');
    setCategoryId(activeExpenseCategories[0]?.id ?? '');
  }

  function startEditing(budget: Budget) {
    setEditingBudget(budget);
    setCategoryId(budget.categoryId);
    setLimitAmount(formatAmount(budget.limitAmount));
    setError('');
    setNotice('');
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const normalizedAmount = toAsciiDigits(limitAmount).replace(/[,\s٬]/g, '');
    if (!/^\d+$/.test(normalizedAmount)) {
      setError('مبلغ بودجه باید عدد صحیح مثبت به تومان باشد.');
      return;
    }
    const amount = Number(normalizedAmount);
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > MAX_BUDGET_AMOUNT
    ) {
      setError('مبلغ بودجه باید بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.');
      return;
    }
    if (!categoryId) {
      setError('ابتدا یک دستهٔ هزینهٔ شخصی و فعال انتخاب کنید.');
      return;
    }

    setSaving(true);
    try {
      await ensureCsrfToken();
      if (editingBudget) {
        await api.patch(`/budgets/${editingBudget.id}`, { categoryId, limitAmount: amount });
      } else {
        await api.post('/budgets', { categoryId, monthKey, limitAmount: amount });
      }
      await refreshBudgets();
      setNotice(editingBudget ? 'بودجه ویرایش شد.' : 'بودجه ثبت شد.');
      resetForm();
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

  async function removeBudget(budget: Budget) {
    if (!window.confirm(`بودجهٔ «${budget.categoryName}» برای این ماه حذف شود؟`)) return;

    setError('');
    setNotice('');
    setDeletingId(budget.id);
    try {
      await ensureCsrfToken();
      await api.delete(`/budgets/${budget.id}`);
      await refreshBudgets();
      if (editingBudget?.id === budget.id) resetForm();
      setNotice('بودجه حذف شد.');
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError) && deleteError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(deleteError));
    } finally {
      setDeletingId(undefined);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6">
        <PageSkeleton label="در حال بارگذاری بودجه‌ها…" variant="budgets" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section className="app-panel order-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-1 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-muted text-sm">مدیریت هزینه‌های ماهانه</p>
              <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">بودجه‌ها</h1>
            </div>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/dashboard">
              بازگشت به داشبورد
            </Link>
          </header>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">{notice}</p>}

          <nav className="mt-6 flex items-center justify-between gap-3" aria-label="انتخاب ماه بودجه">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium"
              disabled={shiftMonth(monthKey, -1) === monthKey}
              onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
              type="button"
            >
              ماه قبل
            </button>
            <h2 className="text-lg font-bold" aria-live="polite">{monthLabel(monthKey)}</h2>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium"
              disabled={shiftMonth(monthKey, 1) === monthKey}
              onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
              type="button"
            >
              ماه بعد
            </button>
          </nav>

          <section className="mt-6" aria-labelledby="budget-list-heading">
            <h2 className="text-xl font-bold text-asoudeh-navy" id="budget-list-heading">
              بودجه‌های {monthLabel(monthKey)}
            </h2>
            {!monthData?.budgets.length ? (
              <p className="app-muted mt-4 rounded-lg bg-slate-50 p-4">
                برای این ماه هنوز بودجه‌ای ثبت نشده است.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {monthData.budgets.map((budget) => {
                  const progressClass =
                    budget.status === 'exceeded'
                      ? 'bg-rose-600'
                      : budget.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-asoudeh-teal';
                  const stateText =
                    budget.status === 'exceeded'
                      ? 'از سقف بودجه عبور کرده‌اید.'
                      : budget.status === 'warning'
                        ? 'به ۸۰٪ بودجه رسیده‌اید.'
                        : 'مصرف بودجه در محدودهٔ عادی است.';
                  const progressValue = Math.min(Math.max(budget.percentageUsed, 0), 100);

                  return (
                    <li className="rounded-xl border border-slate-200 p-4" key={budget.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{budget.categoryName}</p>
                          {!budget.categoryIsActive && (
                            <p className="app-muted mt-1 text-sm">این دسته غیرفعال است.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                            disabled={saving || deletingId === budget.id}
                            onClick={() => startEditing(budget)}
                            type="button"
                          >
                            ویرایش
                          </button>
                          <button
                            className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800"
                            disabled={saving || deletingId === budget.id}
                            onClick={() => void removeBudget(budget)}
                            type="button"
                          >
                            {deletingId === budget.id ? 'در حال حذف…' : 'حذف'}
                          </button>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="app-muted text-sm">سقف بودجه</dt>
                          <dd className="mt-1 font-semibold">{formatAmount(budget.limitAmount)} تومان</dd>
                        </div>
                        <div>
                          <dt className="app-muted text-sm">هزینهٔ واقعی</dt>
                          <dd className="mt-1 font-semibold">{formatAmount(budget.spentAmount)} تومان</dd>
                        </div>
                        <div>
                          <dt className="app-muted text-sm">باقی‌مانده</dt>
                          <dd className={`mt-1 font-semibold ${budget.remainingAmount.startsWith('-') ? 'text-rose-700' : ''}`}>
                            {formatAmount(budget.remainingAmount)} تومان
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4">
                        <div className="flex justify-between gap-3 text-sm">
                          <span>{stateText}</span>
                          <span className="font-semibold">{percentageLabel(budget.percentageUsed)}</span>
                        </div>
                        <div
                          aria-label={`درصد مصرف بودجهٔ ${budget.categoryName}`}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={progressValue}
                          aria-valuetext={`${percentageLabel(budget.percentageUsed)} مصرف شده`}
                          className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"
                          role="progressbar"
                        >
                          <div
                            className={`h-full rounded-full ${progressClass}`}
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>

        <section className="app-panel order-1 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-2 sm:p-8">
          <h2 className="text-xl font-bold text-asoudeh-navy">
            {editingBudget ? 'ویرایش بودجه' : 'ثبت بودجهٔ ماهانه'}
          </h2>
          <p className="app-muted mt-2">{monthLabel(monthKey)}</p>
          <form className="mt-5 space-y-4" onSubmit={saveBudget}>
            <div>
              <label className="mb-2 block font-medium" htmlFor="budgetCategory">دستهٔ هزینه</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-4"
                disabled={!activeExpenseCategories.length && !editingBudget}
                id="budgetCategory"
                onChange={(event) => setCategoryId(event.target.value)}
                required
                value={categoryId}
              >
                {activeExpenseCategories.length === 0 && !editingBudget ? (
                  <option value="">دستهٔ هزینهٔ فعالی ندارید</option>
                ) : (
                  activeExpenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))
                )}
                {editingBudget &&
                  !editingBudget.categoryIsActive &&
                  editingBudget.categoryId === categoryId && (
                    <option value={editingBudget.categoryId}>
                      {editingBudget.categoryName} (غیرفعال)
                    </option>
                  )}
              </select>
              {!activeExpenseCategories.length && !editingBudget && (
                <Link className="mt-2 inline-block text-sm text-asoudeh-teal underline" href="/categories">
                  ابتدا یک دستهٔ هزینهٔ شخصی و فعال بسازید
                </Link>
              )}
            </div>
            <div>
              <label className="mb-2 block font-medium" htmlFor="budgetAmount">سقف بودجه (تومان)</label>
              <input
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                dir="ltr"
                id="budgetAmount"
                inputMode="numeric"
                onChange={(event) => setLimitAmount(formatAmountInput(event.target.value))}
                placeholder="۱٬۰۰۰٬۰۰۰"
                required
                value={limitAmount}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
                disabled={saving || (!activeExpenseCategories.length && !editingBudget)}
                type="submit"
              >
                {saving ? 'در حال ذخیره…' : editingBudget ? 'ذخیرهٔ تغییرات' : 'ثبت بودجه'}
              </button>
              {editingBudget && (
                <button
                  className="rounded-lg border border-slate-300 px-5 py-3 font-medium"
                  disabled={saving}
                  onClick={resetForm}
                  type="button"
                >
                  انصراف
                </button>
              )}
            </div>
          </form>
          <p className="app-muted mt-5 text-sm">
            برای هر دستهٔ هزینه در هر ماه فقط یک بودجه می‌توان ثبت کرد. هزینه‌های حذف‌شده محاسبه نمی‌شوند.
          </p>
        </section>
      </div>
    </main>
  );
}
