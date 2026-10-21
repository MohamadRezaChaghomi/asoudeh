'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import axios from 'axios';
import { api } from '@/lib/api/client';
import { getJalaliParts, getTehranTodayIso, jalaliToGregorianIso } from '@/lib/jalaliDate';

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

interface ApiErrorBody {
  error?: { message?: string };
}

function currentMonthKey(): string {
  const { year, month } = getJalaliParts(getTehranTodayIso());
  return `${String(month).padStart(2, '0')}-${year}`;
}

function shiftMonth(monthKey: string, delta: -1 | 1): string {
  const [monthText, yearText] = monthKey.split('-');
  let month = Number(monthText) + delta;
  let year = Number(yearText);
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  if (year < 1200 || year > 1600) return monthKey;
  return `${String(month).padStart(2, '0')}-${year}`;
}

function isCurrentOrFutureMonth(monthKey: string): boolean {
  const [month, year] = monthKey.split('-').map(Number);
  const [currentMonth, currentYear] = currentMonthKey().split('-').map(Number);
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function monthLabel(monthKey: string): string {
  const [month, year] = monthKey.split('-').map(Number);
  const startDate = jalaliToGregorianIso({ year, month, day: 1 });
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${startDate}T00:00:00.000Z`));
}

function formatAmount(amount: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(BigInt(amount));
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function ReportsPage() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
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
      setError(errorMessage(loadError));
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
        setError(errorMessage(loadError));
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
    <main className="min-h-screen p-5 sm:p-6">
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
            onClick={() => setMonthKey((value) => shiftMonth(value, -1))}
            type="button"
          >
            ماه قبل
          </button>
          <p aria-live="polite" className="font-bold text-asoudeh-navy">{monthLabel(monthKey)}</p>
          <button
            aria-label="ماه بعد"
            className="min-h-11 min-w-11 rounded-lg border border-slate-300 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            disabled={isCurrentOrFutureMonth(monthKey)}
            onClick={() => setMonthKey((value) => shiftMonth(value, 1))}
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
          <p aria-busy="true" className="app-panel rounded-2xl p-6" role="status">
            در حال آماده‌سازی گزارش این ماه…
          </p>
        ) : report ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3" aria-label="جمع‌های ماهانه">
              <article className="app-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-muted text-sm">مجموع درآمد</h2>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatAmount(report.totals.income)} <span className="text-base">تومان</span>
                </p>
              </article>
              <article className="app-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="app-muted text-sm">مجموع هزینه</h2>
                <p className="mt-2 text-2xl font-bold text-rose-700">
                  {formatAmount(report.totals.expenses)} <span className="text-base">تومان</span>
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
                  <div className="mt-6 h-72 w-full" aria-label="نمودار هزینه دسته‌ها">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={report.expensesByCategory}
                        layout="vertical"
                        margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          tickFormatter={(value: number) => new Intl.NumberFormat('fa-IR').format(value)}
                          type="number"
                        />
                        <YAxis dataKey="categoryName" type="category" width={110} />
                        <Tooltip
                          formatter={(value) => [`${formatAmount(String(value))} تومان`, 'هزینه']}
                          labelFormatter={(label) => String(label)}
                        />
                        <Bar dataKey="amount" fill="#0f766e" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-5 divide-y divide-slate-200" aria-label="جزئیات هزینه دسته‌ها">
                    {report.expensesByCategory.map((item) => (
                      <li className="flex flex-wrap justify-between gap-2 py-3" key={item.categoryId}>
                        <span>{item.categoryName} · {new Intl.NumberFormat('fa-IR').format(item.sharePercentage)}٪</span>
                        <span className="font-semibold">{formatAmount(item.amount)} تومان</span>
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
