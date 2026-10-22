'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { api, ensureCsrfToken } from '@/lib/api/client';

interface Profile {
  id: string;
  displayName: string;
  phone: string;
  birthYear: number | null;
  initialBalance: number;
  accessibilitySettings: {
    fontScale: number;
    highContrast: boolean;
  };
}

interface ApiErrorBody {
  error?: { message?: string };
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>();
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletionCodeRequested, setDeletionCodeRequested] = useState(false);
  const [deletionOtpSending, setDeletionOtpSending] = useState(false);
  const [deletionCode, setDeletionCode] = useState('');
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [deletionSaving, setDeletionSaving] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  const [deletionNotice, setDeletionNotice] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await api.get('/me');
        if (!active) return;
        const loaded = response.data.data.profile as Profile;
        setProfile(loaded);
        setDisplayName(loaded.displayName);
        setBirthYear(loaded.birthYear === null ? '' : String(loaded.birthYear));
        setInitialBalance(String(loaded.initialBalance));
        setFontScale(loaded.accessibilitySettings.fontScale);
        setHighContrast(loaded.accessibilitySettings.highContrast);
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

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', `${fontScale * 100}%`);
    document.documentElement.dataset.highContrast = String(highContrast);
  }, [fontScale, highContrast]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const normalizedBalance = toAsciiDigits(initialBalance).replace(/,/g, '');
    if (!/^\d+$/.test(normalizedBalance)) {
      setError('موجودی اولیه را به‌صورت عدد صحیح و غیرمنفی وارد کنید.');
      return;
    }
    const normalizedBirthYear = toAsciiDigits(birthYear).trim();
    if (normalizedBirthYear && !/^\d{4}$/.test(normalizedBirthYear)) {
      setError('سال تولد باید به‌صورت سال چهاررقمی شمسی وارد شود.');
      return;
    }

    setSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.patch('/me/profile', {
        displayName,
        birthYear: normalizedBirthYear ? Number(normalizedBirthYear) : null,
        initialBalance: Number(normalizedBalance),
        accessibilitySettings: { fontScale, highContrast },
      });
      const updated = response.data.data.profile as Profile;
      setProfile(updated);
      setNotice('تغییرات با موفقیت ذخیره شد.');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setError('');
    setSaving(true);
    try {
      await ensureCsrfToken();
      await api.post('/auth/logout');
      router.replace('/login');
    } catch (logoutError) {
      setError(errorMessage(logoutError));
    } finally {
      setSaving(false);
    }
  }

  async function requestDeletionCode() {
    setDeletionError('');
    setDeletionNotice('');
    setDeletionOtpSending(true);
    try {
      const response = await api.post('/auth/otp/request', { phone: profile?.phone });
      setDeletionCodeRequested(true);
      setDeletionCode('');
      const developmentOtp = response.data.data.developmentOtp as string | undefined;
      setDeletionNotice(
        developmentOtp
          ? `קוד האימות לסביבת הפיתוח: ${developmentOtp}`
          : 'אם השירות זמין, קוד אימות נשלח למספר הטלפון של החשבון.',
      );
    } catch (requestError) {
      setDeletionError(errorMessage(requestError));
    } finally {
      setDeletionOtpSending(false);
    }
  }

  async function confirmAccountDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeletionError('');
    setDeletionNotice('');
    setDeletionSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.post('/auth/account-deletion', {
        code: toAsciiDigits(deletionCode).trim(),
      });
      setDeletionNotice(response.data.message ?? 'درخواست حذف حساب ثبت شد.');
      router.replace('/login');
    } catch (deletionErrorValue) {
      setDeletionError(errorMessage(deletionErrorValue));
    } finally {
      setDeletionSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6">
        <PageSkeleton label="در حال بارگذاری پروفایل…" variant="settings" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen p-6">
        <p className="rounded-lg bg-red-50 p-4 text-red-800" role="alert">
          {error || 'بارگذاری پروفایل ممکن نشد.'}
        </p>
        <button className="mt-4 rounded-lg bg-asoudeh-navy px-5 text-white" onClick={() => router.replace('/login')}>
          بازگشت به ورود
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5">
      <section className="app-panel mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="app-muted text-sm">حساب کاربری</p>
            <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">پروفایل و تنظیمات</h1>
            <p className="app-muted mt-2" dir="ltr">{profile.phone}</p>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-4"
            disabled={saving}
            onClick={() => void logout()}
            type="button"
          >
            خروج
          </button>
        </div>
        <Link
          className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 font-medium"
          href="/categories"
        >
          مدیریت دسته‌بندی‌ها
        </Link>

        <form className="mt-7 space-y-5" onSubmit={saveProfile}>
          <div>
            <label className="mb-2 block font-medium" htmlFor="displayName">نام نمایشی</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              id="displayName"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </div>

          <div>
            <label className="mb-2 block font-medium" htmlFor="birthYear">سال تولد شمسی (اختیاری)</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              dir="ltr"
              id="birthYear"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setBirthYear(event.target.value)}
              placeholder="۱۳۳۵"
              value={birthYear}
            />
          </div>

          <div>
            <label className="mb-2 block font-medium" htmlFor="initialBalance">
              موجودی اولیه (تومان)
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              dir="ltr"
              id="initialBalance"
              inputMode="numeric"
              min="0"
              onChange={(event) => setInitialBalance(event.target.value)}
              required
              value={initialBalance}
            />
          </div>

          <div>
            <label className="mb-2 block font-medium" htmlFor="fontScale">اندازه متن</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              id="fontScale"
              onChange={(event) => setFontScale(Number(event.target.value))}
              value={fontScale}
            >
              <option value={1}>۱۰۰٪</option>
              <option value={1.25}>۱۲۵٪</option>
              <option value={1.5}>۱۵۰٪</option>
              <option value={2}>۲۰۰٪</option>
            </select>
          </div>

          <label className="flex min-h-12 items-center gap-3 font-medium" htmlFor="highContrast">
            <input
              checked={highContrast}
              className="size-5"
              id="highContrast"
              onChange={(event) => setHighContrast(event.target.checked)}
              type="checkbox"
            />
            کنتراست بالا
          </label>

          {error && <p className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
          {notice && <p className="rounded-lg bg-green-50 p-3 text-green-800" role="status">{notice}</p>}

          <button
            className="w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </button>
        </form>
      </section>
      <section className="app-panel mx-auto mt-5 max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-red-800">حذف حساب کاربری</h2>
        <p className="app-muted mt-2">
          پس از تأیید کد، دسترسی حساب فوراً بسته می‌شود و همه داده‌ها پس از ۳۰ روز به‌طور دائمی پاک می‌شوند.
          این درخواست قابل بازگشت نیست.
        </p>
        {!deletionCodeRequested ? (
          <button
            className="mt-4 min-h-12 rounded-lg border border-red-700 px-5 font-semibold text-red-800 disabled:opacity-60"
            disabled={deletionOtpSending || deletionSaving || saving}
            onClick={() => void requestDeletionCode()}
            type="button"
          >
            {deletionOtpSending ? 'در حال ارسال کد…' : 'ارسال کد تأیید به شماره حساب'}
          </button>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={confirmAccountDeletion}>
            <button
              className="min-h-12 rounded-lg border border-red-700 px-5 font-semibold text-red-800 disabled:opacity-60"
              disabled={deletionOtpSending || deletionSaving || saving}
              onClick={() => void requestDeletionCode()}
              type="button"
            >
              {deletionOtpSending ? 'در حال ارسال کد…' : 'ارسال دوباره کد تأیید'}
            </button>
            <div>
              <label className="mb-2 block font-medium" htmlFor="accountDeletionCode">
                کد تأیید شش‌رقمی
              </label>
              <input
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                dir="ltr"
                id="accountDeletionCode"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setDeletionCode(event.target.value)}
                pattern="[0-9۰-۹٠-٩]{6}"
                required
                value={deletionCode}
              />
            </div>
            <label className="flex min-h-12 items-center gap-3 font-medium" htmlFor="confirmAccountDeletion">
              <input
                checked={deletionConfirmed}
                className="size-5"
                id="confirmAccountDeletion"
                onChange={(event) => setDeletionConfirmed(event.target.checked)}
                type="checkbox"
              />
              می‌دانم دسترسی فوراً بسته می‌شود و داده‌ها پس از ۳۰ روز پاک می‌شوند.
            </label>
            <button
              className="min-h-12 rounded-lg bg-red-800 px-5 font-semibold text-white disabled:opacity-60"
              disabled={
                deletionSaving ||
                saving ||
                !deletionConfirmed ||
                !/^[0-9۰-۹٠-٩]{6}$/.test(deletionCode)
              }
              type="submit"
            >
              {deletionSaving ? 'در حال ثبت درخواست…' : 'تأیید حذف حساب'}
            </button>
          </form>
        )}
        {deletionError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">
            {deletionError}
          </p>
        )}
        {deletionNotice && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-green-800" role="status">
            {deletionNotice}
          </p>
        )}
      </section>
    </main>
  );
}
