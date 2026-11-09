'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { DeferredExpenseCategoryChart } from '@/components/reports/DeferredExpenseCategoryChart';
import { api } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import {
  formatJalaliMonth,
  getCurrentJalaliMonthKey,
  isCurrentOrFutureJalaliMonth,
  shiftJalaliMonthKey,
} from '@/lib/jalaliDate';
import { formatTomanAmount } from '@/lib/tomanAmount';

interface MonthlyReport {
  monthKey: string;
  totals: {
    income: string;
    expenses: string;
    transactionCount: number;
  };
  comparison: {
    previousMonthKey: string;
    previousExpenses: string;
    expenseChange: string;
    expenseChangePercentage: number | null;
  };
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    amount: string;
    sharePercentage: number;
  }>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(getCurrentJalaliMonthKey);
  const [report, setReport] = useState<MonthlyReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    const response = await api.get<{ success: true; data: { report: MonthlyReport } }>(
      '/reports/monthly',
      { params: { month: monthKey } },
    );
    setReport(response.data.data.report);
  }, [monthKey]);

  async function retryLoad() {
    setLoading(true);
    setError('');
    try {
      await loadReport();
    } catch (loadError) {
      if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<{ success: true; data: { report: MonthlyReport } }>(
          '/reports/monthly',
          { params: { month: monthKey } },
        );
        if (active) setReport(response.data.data.report);
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
    void load();
    return () => {
      active = false;
    };
  }, [monthKey, router]);

  const biggestCategory = report?.expensesByCategory[0];
  const percentageChange = report?.comparison.expenseChangePercentage;
  const comparisonText =
    percentageChange === null || percentageChange === undefined
      ? 'برای ماه قبل هزینه‌ای ثبت نشده است؛ مقایسهٔ درصدی ممکن نیست.'
      : percentageChange > 0
        ? `هزینه‌ها نسبت به ماه قبل ${new Intl.NumberFormat('fa-IR').format(percentageChange)}٪ بیشتر شده است.`
        : percentageChange < 0
          ? `هزینه‌ها نسبت به ماه قبل ${new Intl.NumberFormat('fa-IR').format(Math.abs(percentageChange))}٪ کمتر شده است.`
          : 'هزینه‌ها نسبت به ماه قبل تغییری نکرده است.';

  return (
    <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="app-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="app-muted text-sm">نمای ساده از وضعیت مالی</p>
            <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">گزارش ماهانه</h1>
          </div>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/dashboard">
            بازگشت به داشبورد
          </Link>
        </header>

        <section
          aria-label="انتخاب ماه گزارش"
          className="app-panel flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          dir="rtl"
        >
          <button
            aria-label="ماه قبل"
            className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => setMonthKey((value) => shiftJalaliMonthKey(value, -1))}
            type="button"
          >
            ماه قبل
          </button>
          <p aria-live="polite" className="font-bold text-asoudeh-navy">{formatJalaliMonth(monthKey)}</p>
          <button
            aria-label="ماه بعد"
            className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            disabled={isCurrentOrFutureJalaliMonth(monthKey)}
            onClick={() => setMonthKey((value) => shiftJalaliMonthKey(value, 1))}
            type="button"
          >
            ماه بعد
          </button>
        </section>

        {error && (
          <section className="rounded-xl bg-red-50 p-4 text-red-800" role="alert">
            <p>{error}</p>
            <button
              className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-semibold"
              onClick={() => void retryLoad()}
              type="button"
            >
              دوباره تلاش کنید
            </button>
          </section>
        )}

        {loading ? (
          <PageSkeleton label="در حال آماده‌سازی گزارش این ماه…" showHeader={false} variant="reports" />
        ) : report ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3" aria-label="جمع‌های ماهانه">
              <article className="app-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-muted text-sm">مجموع درآمد</h2>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatTomanAmount(report.totals.income)} <span className="text-base">تومان</span>
                </p>
              </article>
              <article className="app-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-muted text-sm">مجموع هزینه</h2>
                <p className="mt-2 text-2xl font-bold text-rose-700">
                  {formatTomanAmount(report.totals.expenses)} <span className="text-base">تومان</span>
                </p>
              </article>
              <article className="app-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-muted text-sm">تعداد تراکنش‌ها</h2>
                <p className="mt-2 text-2xl font-bold text-asoudeh-navy">
                  {new Intl.NumberFormat('fa-IR').format(report.totals.transactionCount)}
                </p>
              </article>
            </section>

            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-asoudeh-navy">هزینه به تفکیک دسته</h2>
              <p className="app-muted mt-2" role="status">
                {biggestCategory
                  ? `${new Intl.NumberFormat('fa-IR').format(biggestCategory.sharePercentage)}٪ هزینه‌ها صرف ${biggestCategory.categoryName} شده است.`
                  : 'در این ماه هزینه‌ای ثبت نشده است.'}
              </p>
              <p className="mt-2 text-sm">{comparisonText}</p>
              {report.expensesByCategory.length > 0 && (
                <>
                  <DeferredExpenseCategoryChart data={report.expensesByCategory} />
                  <ul className="mt-5 divide-y divide-slate-200" aria-label="جزئیات هزینه دسته‌ها">
                    {report.expensesByCategory.map((item) => (
                      <li className="flex flex-wrap justify-between gap-2 py-3" key={item.categoryId}>
                        <span>{item.categoryName} · {new Intl.NumberFormat('fa-IR').format(item.sharePercentage)}٪</span>
                        <span className="font-semibold">{formatTomanAmount(item.amount)} تومان</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
