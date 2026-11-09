'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { BellRing, ReceiptText } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { TomanAmount } from '@/components/ui/TomanAmount';
import { api } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';

type TransactionType = 'income' | 'expense';

interface DashboardData {
  period: {
    calendar: 'jalali';
    year: number;
    month: number;
    startDate: string;
    endDateExclusive: string;
  };
  balance: {
    initialBalance: number;
    income: string;
    expenses: string;
    remaining: string;
  };
  recentTransactions: Array<{
    id: string;
    type: TransactionType;
    amount: number;
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    date: string;
    note: string;
  }>;
  upcomingReminders: Array<{
    id: string;
    title: string;
    date: string;
    recurrence: 'none' | 'monthly' | 'yearly';
  }>;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatMonth(date: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setDashboard(undefined);
    try {
      const response = await api.get<{ success: true; data: DashboardData }>('/dashboard');
      setDashboard(response.data.data);
    } catch (loadError) {
      if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
        <PageSkeleton label="در حال بارگذاری وضعیت مالی…" variant="dashboard" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-muted text-sm">نمای کلی امور مالی</p>
            <h1 className="mt-1 text-3xl font-bold text-asoudeh-navy">داشبورد</h1>
            {dashboard && (
              <p className="app-muted mt-2">{formatMonth(dashboard.period.startDate)}</p>
            )}
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="بخش‌های مالی">
            <Link
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium"
              href="/transactions"
            >
              فهرست تراکنش‌ها
            </Link>
            <Link
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium"
              href="/budgets"
            >
              بودجه‌ها
            </Link>
          </nav>
        </header>

        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p>{error}</p>
            <button
              className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-medium"
              onClick={() => void loadDashboard()}
              type="button"
            >
              تلاش دوباره
            </button>
          </section>
        )}

        {dashboard && (
          <>
            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="app-muted">باقیماندهٔ این ماه</p>
              <p className="mt-2 break-words text-3xl font-bold text-asoudeh-navy sm:text-4xl">
                <TomanAmount amount={dashboard.balance.remaining} />
              </p>
              <p className="app-muted mt-2 text-sm">
                موجودی اولیه + درآمدهای ماه − هزینه‌های ماه
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm">
                <span className="app-muted">موجودی آغاز ماه</span>
                <span className="font-semibold">
                  <TomanAmount amount={dashboard.balance.initialBalance} />
                </span>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="app-panel rounded-xl border border-emerald-200 bg-white p-5">
                <p className="app-muted">مجموع درآمد این ماه</p>
                <p className="mt-2 break-words text-2xl font-bold text-emerald-700">
                  <TomanAmount amount={dashboard.balance.income} />
                </p>
              </div>
              <div className="app-panel rounded-xl border border-rose-200 bg-white p-5">
                <p className="app-muted">مجموع هزینهٔ این ماه</p>
                <p className="mt-2 break-words text-2xl font-bold text-rose-700">
                  <TomanAmount amount={dashboard.balance.expenses} />
                </p>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Link
                className="flex min-h-16 items-center justify-center rounded-xl bg-asoudeh-navy px-5 py-4 text-center text-lg font-semibold text-white"
                href="/transactions?type=expense"
              >
                ثبت هزینه
              </Link>
              <Link
                className="flex min-h-16 items-center justify-center rounded-xl bg-asoudeh-teal px-5 py-4 text-center text-lg font-semibold text-white"
                href="/transactions?type=income"
              >
                ثبت درآمد
              </Link>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-asoudeh-navy">پنج تراکنش اخیر</h2>
                  <Link className="text-sm font-medium text-asoudeh-teal underline" href="/transactions">
                    مشاهدهٔ همه
                  </Link>
                </div>
                {dashboard.recentTransactions.length === 0 ? (
                  <div className="app-muted mt-4 rounded-lg bg-slate-50 p-4">
                    <div
                      aria-hidden="true"
                      className="mb-3 flex size-24 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--info)]"
                    >
                      <ReceiptText size={44} strokeWidth={1.5} />
                    </div>
                    <p>با ثبت نخستین درآمد یا هزینه، روند مالی ماه را ببینید.</p>
                    <Link className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-asoudeh-navy px-4 font-medium text-white" href="/transactions#transaction-form">
                      ثبت نخستین تراکنش
                    </Link>
                    <Link className="ms-3 inline-flex min-h-12 items-center underline" href="/guide">
                      راهنمای برنامه
                    </Link>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {dashboard.recentTransactions.map((transaction) => (
                      <li className="rounded-xl border border-slate-200 p-4" key={transaction.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{transaction.categoryName}</p>
                            <p className="app-muted mt-1 text-sm">
                              {formatDate(transaction.date)}
                              {transaction.note ? ` · ${transaction.note}` : ''}
                            </p>
                          </div>
                          <p
                            className={`font-bold ${
                              transaction.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '−'}
                            <TomanAmount amount={transaction.amount} />
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-asoudeh-navy">سررسیدهای نزدیک</h2>
                  <Link className="text-sm font-medium text-asoudeh-teal underline" href="/reminders">
                    یادآورها
                  </Link>
                </div>
                {dashboard.upcomingReminders.length === 0 ? (
                  <div className="app-muted mt-4 rounded-lg bg-slate-50 p-4">
                    <div
                      aria-hidden="true"
                      className="mb-3 flex size-24 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--info)]"
                    >
                      <BellRing size={44} strokeWidth={1.5} />
                    </div>
                    <p>برای قبض‌ها و پرداخت‌های آینده یادآور بسازید تا سررسیدشان را فراموش نکنید.</p>
                    <Link className="mt-3 inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-4 font-medium" href="/reminders#reminder-form">
                      افزودن یادآور
                    </Link>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {dashboard.upcomingReminders.map((reminder) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                        key={reminder.id}
                      >
                        <p className="font-semibold">{reminder.title}</p>
                        <time className="app-muted text-sm" dateTime={reminder.date}>
                          {formatDate(reminder.date)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
