'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { BellRing } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { JalaliDatePicker } from '@/components/ui/JalaliDatePicker';
import { Select } from '@/components/ui/Select';
import { TomanAmount } from '@/components/ui/TomanAmount';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import {
  getTehranTodayIso,
  getCurrentJalaliMonthKey,
} from '@/lib/jalaliDate';
import {
  formatTomanAmount,
  formatTomanAmountInput,
  parseTomanAmount,
} from '@/lib/tomanAmount';

type Recurrence = 'none' | 'monthly' | 'yearly';

interface Reminder {
  id: string;
  title: string;
  date: string;
  nextDueDate: string;
  recurrence: Recurrence;
  amount?: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
}

interface ReminderData {
  monthKey: string;
  reminders: Reminder[];
}

const MAX_AMOUNT = 1_000_000_000_000;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default function RemindersPage() {
  const router = useRouter();
  const [data, setData] = useState<ReminderData>();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTehranTodayIso);
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'monthly' | 'yearly'>('none');
  const [editing, setEditing] = useState<Reminder>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string>();
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<'amount' | 'title' | null>(null);
  const [notice, setNotice] = useState('');

  const loadReminders = useCallback(async () => {
    const response = await api.get<{ success: true; data: ReminderData }>('/reminders');
    setData(response.data.data);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<{ success: true; data: ReminderData }>('/reminders');
        if (active) setData(response.data.data);
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
    void initialize();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const refreshOnMonthChange = () => {
      if (data?.monthKey && data.monthKey !== getCurrentJalaliMonthKey()) {
        void loadReminders().catch((loadError: unknown) => setError(getApiErrorMessage(loadError)));
      }
    };
    const interval = window.setInterval(refreshOnMonthChange, 60_000);
    window.addEventListener('focus', refreshOnMonthChange);
    document.addEventListener('visibilitychange', refreshOnMonthChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnMonthChange);
      document.removeEventListener('visibilitychange', refreshOnMonthChange);
    };
  }, [data?.monthKey, loadReminders]);

  function resetForm() {
    setEditing(undefined);
    setTitle('');
    setDate(getTehranTodayIso());
    setAmount('');
    setRecurrence('none');
  }

  function startEditing(reminder: Reminder) {
    setEditing(reminder);
    setTitle(reminder.title);
    setDate(reminder.date);
    setAmount(reminder.amount === undefined ? '' : formatTomanAmount(reminder.amount));
    setRecurrence(reminder.recurrence);
    setError('');
    setNotice('');
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldError(null);
    setNotice('');
    const numericAmount = amount.trim() ? parseTomanAmount(amount) : undefined;
    if (
      (amount.trim() && numericAmount === undefined) ||
      (numericAmount !== undefined &&
        (!Number.isSafeInteger(numericAmount) || numericAmount < 1 || numericAmount > MAX_AMOUNT))
    ) {
      setError('مبلغ باید عدد صحیحی بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.');
      setFieldError('amount');
      return;
    }
    if (!title.trim()) {
      setError('عنوان یادآور را وارد کنید.');
      setFieldError('title');
      return;
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      date,
      ...(numericAmount === undefined ? (editing ? { amount: null } : {}) : { amount: numericAmount }),
    };
    if (!editing || recurrence !== 'yearly') payload.recurrence = recurrence;

    setSaving(true);
    try {
      await ensureCsrfToken();
      if (editing) await api.patch(`/reminders/${editing.id}`, payload);
      else await api.post('/reminders', payload);
      await loadReminders();
      setNotice(editing ? 'یادآور ویرایش شد.' : 'یادآور ثبت شد.');
      resetForm();
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

  async function complete(reminder: Reminder) {
    setError('');
    setNotice('');
    setActionId(reminder.id);
    try {
      await ensureCsrfToken();
      await api.post(`/reminders/${reminder.id}/complete`, {});
      await loadReminders();
      setNotice(
        reminder.recurrence === 'monthly'
          ? 'یادآور این ماه انجام شد؛ سابقهٔ آن حفظ می‌شود.'
          : 'یادآور انجام شد و دیگر تکرار نمی‌شود.',
      );
    } catch (completeError) {
      if (axios.isAxiosError(completeError) && completeError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(completeError));
    } finally {
      setActionId(undefined);
    }
  }

  async function archive(reminder: Reminder) {
    if (!window.confirm(`یادآور «${reminder.title}» بایگانی شود؟ تاریخچهٔ انجام حفظ خواهد شد.`)) {
      return;
    }
    setError('');
    setNotice('');
    setActionId(reminder.id);
    try {
      await ensureCsrfToken();
      await api.delete(`/reminders/${reminder.id}`);
      await loadReminders();
      if (editing?.id === reminder.id) resetForm();
      setNotice('یادآور بایگانی شد.');
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError) && deleteError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(getApiErrorMessage(deleteError));
    } finally {
      setActionId(undefined);
    }
  }

  const activeCount = data?.reminders.filter(({ isActive }) => isActive).length ?? 0;

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
        <PageSkeleton label="در حال بارگذاری یادآورها…" variant="reminders" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-6" id="main-content" tabIndex={-1}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <section className="app-panel order-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-1 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-muted text-sm">سررسیدها و کارهای مالی</p>
              <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">یادآورها</h1>
              <p className="app-muted mt-2">{activeCount} یادآور فعال · ماه {data?.monthKey}</p>
            </div>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/dashboard">
              بازگشت به داشبورد
            </Link>
          </header>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" id={fieldError ? 'reminder-field-error' : undefined} role="alert">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status" aria-live="polite" aria-atomic="true">{notice}</p>}

          {!data?.reminders.length ? (
            <div className="app-muted mt-6 rounded-lg bg-slate-50 p-5">
              <div
                aria-hidden="true"
                className="mb-3 flex size-24 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--info)]"
                data-testid="empty-reminders-illustration"
              >
                <BellRing size={44} strokeWidth={1.5} />
              </div>
              <p>برای قبض یا پرداخت بعدی یادآور بسازید تا سررسیدش را به‌خاطر بسپارید.</p>
              <a className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-asoudeh-navy px-4 font-medium text-white" href="#reminder-form">
                ساخت نخستین یادآور
              </a>
              <Link className="ms-3 inline-flex min-h-12 items-center underline" href="/guide">
                راهنمای یادآورها
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {data.reminders.map((reminder) => {
                const completed = reminder.isCompleted;
                const status = completed
                  ? 'انجام‌شده'
                  : !reminder.isActive
                    ? 'بایگانی‌شده'
                    : 'فعال';
                return (
                  <li className="rounded-xl border border-slate-200 p-4 sm:p-5" key={reminder.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-asoudeh-navy">{reminder.title}</h2>
                        <p className="app-muted mt-1 text-sm">
                          سررسید {formatDate(reminder.nextDueDate)}
                          {reminder.recurrence === 'monthly'
                            ? ' · تکرار ماهانه'
                            : reminder.recurrence === 'yearly'
                              ? ' · تکرار سالانهٔ قدیمی'
                              : ' · بدون تکرار'}
                        </p>
                        {reminder.amount !== undefined && (
                          <p className="mt-2 font-medium"><TomanAmount amount={reminder.amount} /></p>
                        )}
                        <p className={`mt-2 text-sm font-semibold ${completed ? 'text-emerald-700' : reminder.isActive ? 'text-asoudeh-teal' : 'app-muted'}`}>
                          وضعیت: {status}
                          {reminder.recurrence === 'monthly' && completed && ' در این ماه'}
                        </p>
                        {reminder.recurrence === 'yearly' && (
                          <p className="app-muted mt-1 text-sm">
                            نوع تکرار قدیمی حفظ شده؛ برای استفاده از تکرارهای جدید، آن را ویرایش کنید.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reminder.isActive && !completed && reminder.recurrence !== 'yearly' && (
                          <button
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={actionId === reminder.id}
                            onClick={() => void complete(reminder)}
                            type="button"
                          >
                            {actionId === reminder.id ? 'در حال ثبت…' : 'انجام شد'}
                          </button>
                        )}
                        {!completed && (
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                            disabled={saving || actionId === reminder.id}
                            onClick={() => startEditing(reminder)}
                            type="button"
                          >
                            ویرایش
                          </button>
                        )}
                        {reminder.isActive && (
                          <button
                            className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800"
                            disabled={saving || actionId === reminder.id}
                            onClick={() => void archive(reminder)}
                            type="button"
                          >
                            بایگانی
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="app-panel order-1 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-2 sm:p-8" id="reminder-form">
          <h2 className="text-xl font-bold text-asoudeh-navy">
            {editing ? 'ویرایش یادآور' : 'افزودن یادآور'}
          </h2>
          <form className="mt-5 space-y-4" noValidate onSubmit={saveReminder}>
            <div>
              <label className="mb-1 block font-medium" htmlFor="reminder-title">عنوان</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                id="reminder-title"
                maxLength={120}
                aria-invalid={fieldError === 'title'}
                aria-describedby={fieldError === 'title' ? 'reminder-field-error' : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setFieldError(null);
                }}
                required
                value={title}
              />
            </div>
            <div>
              <p className="mb-2 font-medium">تاریخ سررسید شمسی</p>
              <JalaliDatePicker label="انتخاب تاریخ سررسید شمسی" onChange={setDate} value={date} />
            </div>
            <div>
              <label className="mb-1 block font-medium" htmlFor="reminder-amount">
                مبلغ (اختیاری، تومان)
              </label>
              <input
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                dir="ltr"
                id="reminder-amount"
                inputMode="numeric"
                aria-invalid={fieldError === 'amount'}
                aria-describedby={fieldError === 'amount' ? 'reminder-field-error' : undefined}
                onChange={(event) => {
                  setAmount(formatTomanAmountInput(event.target.value));
                  setFieldError(null);
                }}
                placeholder="۱٬۰۰۰٬۰۰۰"
                value={amount}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium" htmlFor="reminder-recurrence">تکرار</label>
              <Select
                id="reminder-recurrence"
                onChange={(value) => {
                  if (value === 'none' || value === 'monthly' || value === 'yearly') {
                    setRecurrence(value);
                  }
                }}
                options={[
                  { value: 'none', label: 'بدون تکرار' },
                  { value: 'monthly', label: 'ماهانه' },
                  ...(editing?.recurrence === 'yearly'
                    ? [{ value: 'yearly', label: 'سالانه (نوع قدیمی؛ بدون تغییر حفظ می‌شود)' }]
                    : []),
                ]}
                value={recurrence}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? 'در حال ذخیره…' : editing ? 'ذخیرهٔ تغییرات' : 'ثبت یادآور'}
              </button>
              {editing && (
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
            انجام یادآور ماهانه فقط برای ماه جاری ثبت می‌شود و در ماه بعد دوباره فعال خواهد بود.
            یادآور بدون تکرار پس از انجام غیرفعال می‌شود.
          </p>
        </section>
      </div>
    </main>
  );
}
