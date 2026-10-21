'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { api } from '@/lib/api/client';
import { getJalaliParts, getTehranTodayIso } from '@/lib/jalaliDate';

type Permission = 'VIEW_SUMMARY' | 'VIEW_TRANSACTIONS' | 'VIEW_REPORTS';

interface AccessibleSenior {
  seniorId: string;
  seniorName: string;
  permissions: Permission[];
}

interface SeniorSummary {
  period: { monthKey: string };
  balance: {
    initialBalance: number;
    income: string;
    expenses: string;
    remaining: string;
  };
}

interface SeniorTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryName: string;
  date: string;
  note: string;
}

interface SeniorReport {
  monthKey: string;
  totals: { income: string; expenses: string; transactionCount: number };
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
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

function formatAmount(amount: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(BigInt(amount));
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function CaregiverSeniorPage() {
  const { seniorId } = useParams<{ seniorId: string }>();
  const router = useRouter();
  const [senior, setSenior] = useState<AccessibleSenior>();
  const [summary, setSummary] = useState<SeniorSummary>();
  const [transactions, setTransactions] = useState<SeniorTransaction[]>([]);
  const [report, setReport] = useState<SeniorReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const list = await api.get<{ success: true; data: { seniors: AccessibleSenior[] } }>(
          '/caregiver/seniors',
        );
        const allowedSenior = list.data.data.seniors.find((item) => item.seniorId === seniorId);
        if (!allowedSenior) {
          setError('دسترسی فعالی به این حساب ندارید.');
          return;
        }
        if (active) setSenior(allowedSenior);
        const requests: Promise<void>[] = [];
        if (allowedSenior.permissions.includes('VIEW_SUMMARY')) {
          requests.push(
            api.get<{ success: true; data: { summary: SeniorSummary } }>(
              `/caregiver/seniors/${seniorId}/summary`,
            ).then((response) => {
              if (active) setSummary(response.data.data.summary);
            }),
          );
        }
        if (allowedSenior.permissions.includes('VIEW_TRANSACTIONS')) {
          requests.push(
            api.get<{
              success: true;
              data: { transactions: SeniorTransaction[] };
            }>(`/caregiver/seniors/${seniorId}/transactions`, {
              params: { page: 1, pageSize: 20 },
            }).then((response) => {
              if (active) setTransactions(response.data.data.transactions);
            }),
          );
        }
        if (allowedSenior.permissions.includes('VIEW_REPORTS')) {
          requests.push(
            api.get<{ success: true; data: { report: SeniorReport } }>(
              `/caregiver/seniors/${seniorId}/reports/monthly`,
              { params: { month: currentMonthKey() } },
            ).then((response) => {
              if (active) setReport(response.data.data.report);
            }),
          );
        }
        await Promise.all(requests);
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
  }, [router, seniorId]);

  return (
    <main className="min-h-screen p-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="app-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="app-muted text-sm">نمای فقط‌خواندنی و محدود به مجوزهای دریافتی</p>
            <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">
              {senior?.seniorName ?? 'نمای مراقب'}
            </h1>
          </div>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/caregiver">
            بازگشت به مدیریت مراقب
          </Link>
        </header>

        {loading && <p aria-busy="true" className="app-panel rounded-2xl p-6" role="status">در حال بارگذاری اطلاعات مجاز…</p>}
        {error && <p className="rounded-lg bg-red-50 p-4 text-red-800" role="alert">{error}</p>}
        {!loading && senior && (
          <>
            <p className="app-muted">مجوزها: {senior.permissions.join('، ')}</p>
            {summary && (
              <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">خلاصهٔ مالی ماه {summary.period.monthKey}</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="app-muted">موجودی اولیه</dt><dd className="mt-1 font-bold">{formatAmount(summary.balance.initialBalance)} تومان</dd></div>
                  <div><dt className="app-muted">درآمد این ماه</dt><dd className="mt-1 font-bold text-emerald-700">{formatAmount(summary.balance.income)} تومان</dd></div>
                  <div><dt className="app-muted">هزینه این ماه</dt><dd className="mt-1 font-bold text-rose-700">{formatAmount(summary.balance.expenses)} تومان</dd></div>
                  <div><dt className="app-muted">باقی‌مانده</dt><dd className="mt-1 font-bold">{formatAmount(summary.balance.remaining)} تومان</dd></div>
                </dl>
              </section>
            )}

            {report && (
              <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">گزارش ماه {report.monthKey}</h2>
                <p className="mt-3">درآمد: {formatAmount(report.totals.income)} تومان</p>
                <p className="mt-1">هزینه: {formatAmount(report.totals.expenses)} تومان</p>
                <h3 className="mt-5 font-semibold">هزینه بر اساس دسته</h3>
                {report.expensesByCategory.length ? (
                  <ul className="mt-2 divide-y divide-slate-200">
                    {report.expensesByCategory.map((item) => (
                      <li className="flex justify-between gap-3 py-3" key={item.categoryId}>
                        <span>{item.categoryName} · {new Intl.NumberFormat('fa-IR').format(item.sharePercentage)}٪</span>
                        <span className="font-semibold">{formatAmount(item.amount)} تومان</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="app-muted mt-2">برای این ماه هزینه‌ای ثبت نشده است.</p>
                )}
              </section>
            )}

            {senior.permissions.includes('VIEW_TRANSACTIONS') && (
              <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">تراکنش‌های اخیر</h2>
                {transactions.length ? (
                  <ul className="mt-4 divide-y divide-slate-200">
                    {transactions.map((transaction) => (
                      <li className="flex flex-wrap justify-between gap-2 py-3" key={transaction.id}>
                        <div>
                          <p className="font-semibold">{transaction.categoryName}</p>
                          <p className="app-muted text-sm">{transaction.date} {transaction.note && `· ${transaction.note}`}</p>
                        </div>
                        <p className={transaction.type === 'income' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                          {transaction.type === 'income' ? 'درآمد' : 'هزینه'} · {formatAmount(transaction.amount)} تومان
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="app-muted mt-3">تراکنشی برای نمایش وجود ندارد.</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
