'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { api, ensureCsrfToken } from '@/lib/api/client';
import {
  getJalaliMonthDays,
  getJalaliParts,
  getTehranTodayIso,
  jalaliToGregorianIso,
} from '@/lib/jalaliDate';

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

interface ApiErrorBody {
  error?: { message?: string };
}

const MAX_AMOUNT = 1_000_000_000_000;
const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function formatAmount(value: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(BigInt(value));
}

function formatAmountInput(value: string): string {
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('fa-IR').format(BigInt(digits)) : '';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function currentMonthKey(): string {
  const parts = getJalaliParts(getTehranTodayIso());
  return `${String(parts.month).padStart(2, '0')}-${parts.year}`;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

function JalaliDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const selected = getJalaliParts(value);
  const currentYear = getJalaliParts(getTehranTodayIso()).year;
  const years = useMemo(() => {
    const first = Math.max(1200, Math.min(currentYear - 10, selected.year));
    const last = Math.min(1600, Math.max(currentYear + 20, selected.year));
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [currentYear, selected.year]);
  const days = getJalaliMonthDays(selected.year, selected.month);

  function changeMonth(year: number, month: number, day: number) {
    const availableDays = getJalaliMonthDays(year, month);
    const safeDay = Math.min(day, availableDays.length);
    onChange(jalaliToGregorianIso({ year, month, day: safeDay }));
  }

  return (
    <fieldset className="rounded-lg border border-slate-300 p-4">
      <legend className="px-1 font-medium">تاریخ سررسید شمسی</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm" htmlFor="reminder-year">سال</label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3"
            id="reminder-year"
            onChange={(event) => changeMonth(Number(event.target.value), selected.month, selected.day)}
            value={selected.year}
          >
            {years.map((year) => <option key={year} value={year}>{new Intl.NumberFormat('fa-IR').format(year)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="reminder-month">ماه</label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3"
            id="reminder-month"
            onChange={(event) => changeMonth(selected.year, Number(event.target.value), selected.day)}
            value={selected.month}
          >
            {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm" htmlFor="reminder-day">روز</label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3"
            id="reminder-day"
            onChange={(event) => onChange(days[Number(event.target.value) - 1])}
            value={selected.day}
          >
            {days.map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Intl.NumberFormat('fa-IR').format(index + 1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
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
        setError(errorMessage(loadError));
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
      if (data?.monthKey && data.monthKey !== currentMonthKey()) {
        void loadReminders().catch((loadError: unknown) => setError(errorMessage(loadError)));
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
    setAmount(reminder.amount === undefined ? '' : formatAmount(reminder.amount));
    setRecurrence(reminder.recurrence);
    setError('');
    setNotice('');
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalizedAmount = toAsciiDigits(amount).replace(/[,\s٬]/g, '');
    const numericAmount = normalizedAmount ? Number(normalizedAmount) : undefined;
    if (
      numericAmount !== undefined &&
      (!Number.isSafeInteger(numericAmount) || numericAmount < 1 || numericAmount > MAX_AMOUNT)
    ) {
      setError('مبلغ باید عدد صحیحی بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.');
      return;
    }
    if (!title.trim()) {
      setError('عنوان یادآور را وارد کنید.');
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
      setError(errorMessage(saveError));
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
      setError(errorMessage(completeError));
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
      setError(errorMessage(deleteError));
    } finally {
      setActionId(undefined);
    }
  }

  const activeCount = data?.reminders.filter(({ isActive }) => isActive).length ?? 0;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6" aria-busy="true">
        <p role="status">در حال بارگذاری یادآورها…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-6">
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

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">{notice}</p>}

          {!data?.reminders.length ? (
            <p className="app-muted mt-6 rounded-lg bg-slate-50 p-5">
              هنوز یادآوری ثبت نکرده‌اید. می‌توانید سررسید قبض یا پرداخت بعدی را اضافه کنید.
            </p>
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
                          <p className="mt-2 font-medium">{formatAmount(reminder.amount)} تومان</p>
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

        <section className="app-panel order-1 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-2 sm:p-8">
          <h2 className="text-xl font-bold text-asoudeh-navy">
            {editing ? 'ویرایش یادآور' : 'افزودن یادآور'}
          </h2>
          <form className="mt-5 space-y-4" onSubmit={saveReminder}>
            <div>
              <label className="mb-1 block font-medium" htmlFor="reminder-title">عنوان</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                id="reminder-title"
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </div>
            <JalaliDateInput value={date} onChange={setDate} />
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
                onChange={(event) => setAmount(formatAmountInput(event.target.value))}
                placeholder="۱٬۰۰۰٬۰۰۰"
                value={amount}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium" htmlFor="reminder-recurrence">تکرار</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-4"
                id="reminder-recurrence"
                onChange={(event) => setRecurrence(event.target.value as Recurrence)}
                value={recurrence}
              >
                <option value="none">بدون تکرار</option>
                <option value="monthly">ماهانه</option>
                {editing?.recurrence === 'yearly' && (
                  <option value="yearly">سالانه (نوع قدیمی؛ بدون تغییر حفظ می‌شود)</option>
                )}
              </select>
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
