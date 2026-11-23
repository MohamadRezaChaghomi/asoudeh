'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ReceiptText } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { TomanAmount } from '@/components/ui/TomanAmount';
import { DeferredExpenseCategoryChart } from '@/components/reports/DeferredExpenseCategoryChart';
import { api } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import {
  formatJalaliMonth,
  getCurrentJalaliMonthKey,
  isCurrentOrFutureJalaliMonth,
  shiftJalaliMonthKey,
} from '@/lib/jalaliDate';

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
  const hasComparison = percentageChange !== null && percentageChange !== undefined;
  const formattedPercentageChange = hasComparison
    ? new Intl.NumberFormat('fa-IR').format(Math.abs(percentageChange))
    : '';
  const comparisonText = !hasComparison
    ? 'برای ماه قبل هزینه‌ای ثبت نشده است؛ مقایسهٔ درصدی ممکن نیست.'
    : percentageChange > 0
      ? 'هزینه‌ها نسبت به ماه قبل افزایش داشته است.'
      : percentageChange < 0
        ? 'هزینه‌ها نسبت به ماه قبل کاهش داشته است.'
        : 'هزینه‌ها نسبت به ماه قبل تغییری نکرده است.';
  const comparisonLabel = !hasComparison
    ? 'بدون مقایسه'
    : percentageChange > 0
      ? `${formattedPercentageChange}٪ افزایش`
      : percentageChange < 0
        ? `${formattedPercentageChange}٪ کاهش`
        : 'بدون تغییر';
  const comparisonToneClass = !hasComparison
    ? 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
    : percentageChange > 0
      ? 'bg-[var(--negative-soft)] text-[var(--negative)]'
      : percentageChange < 0
        ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
        : 'bg-[var(--brand-100)] text-[var(--brand-900)]';

  return (
    <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="app-panel flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-100)] text-[var(--brand-900)]"
            >
              <ReceiptText size={28} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="app-muted text-sm font-semibold">نمای کلی این ماه</p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--brand-900)]">گزارش ماهانه</h1>
              <p className="app-muted mt-1 text-sm">درآمد، هزینه‌ها و روند تغییرات مالی خود را یک‌جا ببینید.</p>
            </div>
          </div>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--text)]"
            href="/dashboard"
          >
            بازگشت به داشبورد
          </Link>
        </header>

        <section
          aria-label="انتخاب ماه گزارش"
          className="app-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
          dir="rtl"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-900)]"
            >
              <CalendarDays size={22} />
            </span>
            <div>
              <p className="app-muted text-xs font-semibold">ماه گزارش</p>
              <p aria-live="polite" className="mt-1 text-lg font-bold text-[var(--brand-900)]">
                {formatJalaliMonth(monthKey)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              aria-label="ماه قبل"
              className="min-h-11 rounded-xl border border-[var(--border-strong)] px-4 font-semibold text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              onClick={() => setMonthKey((value) => shiftJalaliMonthKey(value, -1))}
              type="button"
            >
              ماه قبل
            </button>
            <button
              aria-label="ماه بعد"
              className="min-h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 font-semibold text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              disabled={isCurrentOrFutureJalaliMonth(monthKey)}
              onClick={() => setMonthKey((value) => shiftJalaliMonthKey(value, 1))}
              type="button"
            >
              ماه بعد
            </button>
          </div>
        </section>

        {error && (
          <section
            className="rounded-2xl border border-[var(--negative)] bg-[var(--negative-soft)] p-4 text-[var(--negative)]"
            role="alert"
          >
            <p>{error}</p>
            <button
              className="mt-3 min-h-11 rounded-xl border border-[var(--negative)] px-4 py-2 font-semibold"
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
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="جمع‌های ماهانه">
              <article className="app-panel rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="app-muted text-sm font-semibold">مجموع درآمد</h2>
                    <p className="mt-3 break-words text-2xl font-extrabold leading-tight text-[var(--positive)]">
                      <TomanAmount
                        amount={report.totals.income}
                        className="whitespace-nowrap tabular-nums"
                        unitClassName="whitespace-nowrap text-sm font-semibold"
                      />
                    </p>
                    <p className="app-muted mt-2 text-sm">دریافتی‌های ثبت‌شده در این ماه</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--positive-soft)] text-[var(--positive)]"
                  >
                    <ArrowUpRight size={24} strokeWidth={2} />
                  </span>
                </div>
              </article>
              <article className="app-panel rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="app-muted text-sm font-semibold">مجموع هزینه</h2>
                    <p className="mt-3 break-words text-2xl font-extrabold leading-tight text-[var(--negative)]">
                      <TomanAmount
                        amount={report.totals.expenses}
                        className="whitespace-nowrap tabular-nums"
                        unitClassName="whitespace-nowrap text-sm font-semibold"
                      />
                    </p>
                    <p className="app-muted mt-2 text-sm">پرداخت‌های ثبت‌شده در این ماه</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--negative-soft)] text-[var(--negative)]"
                  >
                    <ArrowDownLeft size={24} strokeWidth={2} />
                  </span>
                </div>
              </article>
              <article className="app-panel rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:col-span-2 sm:p-6 xl:col-span-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="app-muted text-sm font-semibold">تعداد تراکنش‌ها</h2>
                    <p className="mt-3 text-3xl font-extrabold tabular-nums text-[var(--brand-900)]">
                      {new Intl.NumberFormat('fa-IR').format(report.totals.transactionCount)}
                    </p>
                    <p className="app-muted mt-2 text-sm">مجموع ثبت‌های مالی این ماه</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-100)] text-[var(--brand-900)]"
                  >
                    <ReceiptText size={24} strokeWidth={1.8} />
                  </span>
                </div>
              </article>
            </section>

            <section
              aria-label="مقایسه هزینه با ماه قبل"
              className="app-panel grid gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${comparisonToneClass}`}
                >
                  {!hasComparison || percentageChange === 0 ? (
                    <ReceiptText size={24} strokeWidth={1.8} />
                  ) : percentageChange > 0 ? (
                    <ArrowUpRight size={24} />
                  ) : (
                    <ArrowDownLeft size={24} />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="app-muted text-sm font-semibold">مقایسه با ماه قبل</h2>
                  <p className="mt-1 text-lg font-bold text-[var(--text)]">{comparisonText}</p>
                  <p className="app-muted mt-2 text-sm">
                    هزینهٔ ماه قبل:{' '}
                    <span className="font-semibold text-[var(--text)]">
                      <TomanAmount amount={report.comparison.previousExpenses} unitClassName="text-xs" />
                    </span>
                  </p>
                </div>
              </div>
              <div className={`min-w-32 rounded-xl px-4 py-3 text-center ${comparisonToneClass}`}>
                <p className="text-xs font-semibold">میزان تغییر</p>
                <p className="mt-1 text-lg font-extrabold">{comparisonLabel}</p>
              </div>
            </section>

            <section className="app-panel rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
                <div>
                  <p className="app-muted text-sm font-semibold">جزئیات هزینه‌ها</p>
                  <h2 className="mt-1 text-xl font-bold text-[var(--brand-900)]">هزینه به تفکیک دسته</h2>
                  <p className="app-muted mt-2 text-sm">
                    مبلغ و سهم هر دسته از کل هزینه‌های این ماه را مقایسه کنید.
                  </p>
                </div>
                <p
                  className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--brand-900)]"
                  role="status"
                >
                  {biggestCategory
                    ? `${new Intl.NumberFormat('fa-IR').format(biggestCategory.sharePercentage)}٪ هزینه‌ها صرف ${biggestCategory.categoryName} شده است.`
                    : 'در این ماه هزینه‌ای ثبت نشده است.'}
                </p>
              </header>
              {report.expensesByCategory.length > 0 ? (
                <DeferredExpenseCategoryChart data={report.expensesByCategory} />
              ) : (
                <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-5 py-8 text-center">
                  <span
                    aria-hidden="true"
                    className="flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-100)] text-[var(--brand-900)]"
                  >
                    <ReceiptText size={28} strokeWidth={1.8} />
                  </span>
                  <p className="mt-3 font-bold">هنوز هزینه‌ای ثبت نشده است</p>
                  <p className="app-muted mt-1 text-sm">با ثبت هزینه، جزئیات دسته‌بندی آن در این بخش نمایش داده می‌شود.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
