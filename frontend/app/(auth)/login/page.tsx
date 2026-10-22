'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { api } from '@/lib/api/client';
import { clearPendingOtpFlow, savePendingOtpFlow } from '@/lib/auth/otpFlow';

const DEVELOPMENT_QUICK_LOGIN_PHONE = '09120000000';

interface ApiErrorBody {
  error?: { message?: string };
}

interface OtpRequestResponse {
  data: {
    developmentOtp?: string;
    developmentQuickLogin?: boolean;
    registrationRequired?: boolean;
    resendAfterSeconds?: number;
  };
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
  if (error instanceof Error) return error.message;
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState(
    process.env.NODE_ENV === 'development' ? DEVELOPMENT_QUICK_LOGIN_PHONE : '',
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get('session') === 'expired') {
      setNotice('نشست شما به‌دلیل بی‌کاری پایان یافت. برای ادامه دوباره وارد شوید.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;

    setError('');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('شماره همراه ایرانی معتبر وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.');
      return;
    }

    requestInFlight.current = true;
    setLoading(true);
    try {
      const response = await api.post<OtpRequestResponse>(
        '/auth/otp/request',
        { phone: normalizedPhone },
      );
      const requestData = response.data.data;
      const resendAfterSeconds =
        typeof requestData?.resendAfterSeconds === 'number'
          ? requestData.resendAfterSeconds
          : 60;
      const resendAvailableAt = Date.now() + resendAfterSeconds * 1000;

      if (
        requestData?.developmentQuickLogin === true &&
        typeof requestData.developmentOtp === 'string'
      ) {
        const verification = await api.post<OtpRequestResponse>('/auth/otp/verify', {
          phone: normalizedPhone,
          code: requestData.developmentOtp,
        });

        if (verification.data.data?.registrationRequired) {
          savePendingOtpFlow({
            phone: normalizedPhone,
            resendAvailableAt,
            step: 'register',
          });
          router.push('/verify-otp');
          return;
        }

        clearPendingOtpFlow();
        router.replace('/settings');
        return;
      }

      savePendingOtpFlow({
        phone: normalizedPhone,
        ...(process.env.NODE_ENV === 'development' &&
        typeof requestData?.developmentOtp === 'string'
          ? { developmentOtp: requestData.developmentOtp }
          : {}),
        resendAvailableAt,
        step: 'code',
      });
      router.push('/verify-otp');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <section className="app-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <BrandLogo className="mx-auto mb-5" size="auth" />
        <p className="app-muted text-sm">مدیریت مالی شخصی سالمندان</p>
        <h1 className="mt-2 text-2xl font-bold text-asoudeh-navy">ورود به حساب کاربری</h1>
        <p className="app-muted mt-2">با شماره همراه خود وارد شوید یا حساب بسازید.</p>

        {notice && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950" role="status">
            {notice}
          </p>
        )}

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

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
