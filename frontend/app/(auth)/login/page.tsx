'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api/client';

type LoginStep = 'phone' | 'code' | 'register';

interface ApiErrorBody {
  error?: { message?: string };
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function normalizePhone(value: string): string | null {
  const compact = toAsciiDigits(value).replace(/[\s()-]/g, '');
  let canonical = compact;

  if (/^\+989\d{9}$/.test(compact)) canonical = `0${compact.slice(3)}`;
  else if (/^00989\d{9}$/.test(compact)) canonical = `0${compact.slice(4)}`;
  else if (/^989\d{9}$/.test(compact)) canonical = `0${compact.slice(2)}`;
  else if (/^9\d{9}$/.test(compact)) canonical = `0${compact}`;

  return /^09\d{9}$/.test(canonical) ? canonical : null;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [developmentOtp, setDevelopmentOtp] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError('');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('شماره همراه ایرانی معتبر وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/otp/request', { phone: normalizedPhone });
      setPhone(normalizedPhone);
      setDevelopmentOtp(response.data.data.developmentOtp);
      setStep('code');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedCode = toAsciiDigits(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('کد تأیید باید شامل ۶ رقم باشد.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/otp/verify', {
        phone,
        code: normalizedCode,
      });
      if (response.data.data.registrationRequired) {
        setStep('register');
        return;
      }
      router.push('/settings');
    } catch (verifyError) {
      setError(errorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  }

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register/complete', { displayName });
      router.push('/settings');
    } catch (registrationError) {
      setError(errorMessage(registrationError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <section className="app-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="app-muted text-sm">مدیریت مالی شخصی سالمندان</p>
        <h1 className="mt-2 text-2xl font-bold text-asoudeh-navy">ورود به آسوده</h1>
        <p className="app-muted mt-2">با شماره همراه خود وارد شوید یا حساب بسازید.</p>

        {step === 'phone' && (
          <form className="mt-6 space-y-4" onSubmit={requestCode}>
            <label className="block font-medium" htmlFor="phone">
              شماره همراه
            </label>
            <input
              autoComplete="tel"
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              dir="ltr"
              id="phone"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              required
              value={phone}
            />
            <button
              className="w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? 'در حال ارسال…' : 'دریافت کد تأیید'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="mt-6 space-y-4" onSubmit={verifyCode}>
            <p className="app-muted">کد شش‌رقمی ارسال‌شده به {phone} را وارد کنید.</p>
            {process.env.NODE_ENV === 'development' && developmentOtp && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900" role="status">
                کد شبیه‌ساز توسعه: <bdi dir="ltr">{developmentOtp}</bdi>
              </p>
            )}
            <label className="block font-medium" htmlFor="otp">
              کد تأیید
            </label>
            <input
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 text-center text-xl tracking-[0.4em]"
              dir="ltr"
              id="otp"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              pattern="[0-9۰-۹٠-٩]{6}"
              required
              value={code}
            />
            <button
              className="w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? 'در حال بررسی…' : 'تأیید و ادامه'}
            </button>
            <button
              className="w-full rounded-lg border border-slate-300 px-4 font-medium disabled:opacity-60"
              disabled={loading}
              onClick={() => void requestCode()}
              type="button"
            >
              ارسال دوباره کد
            </button>
          </form>
        )}

        {step === 'register' && (
          <form className="mt-6 space-y-4" onSubmit={completeRegistration}>
            <p className="app-muted">برای ساخت حساب، نام نمایشی خود را وارد کنید.</p>
            <label className="block font-medium" htmlFor="displayName">
              نام نمایشی
            </label>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              id="displayName"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
            <button
              className="w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? 'در حال ساخت حساب…' : 'ساخت حساب'}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
