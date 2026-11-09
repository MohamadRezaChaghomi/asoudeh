'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AuthBackButton } from '@/components/auth/AuthBackButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { api } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import { savePendingOtpFlow } from '@/lib/auth/otpFlow';
import { normalizeDigits } from '@/lib/normalizeDigits';

interface OtpRequestResponse {
  data: {
    registrationRequired?: boolean;
    resendAfterSeconds?: number;
  };
}

function normalizePhone(value: string): string | null {
  const compact = normalizeDigits(value).replace(/[\s()-]/g, '');
  let canonical = compact;

  if (/^\+989\d{9}$/.test(compact)) canonical = `0${compact.slice(3)}`;
  else if (/^00989\d{9}$/.test(compact)) canonical = `0${compact.slice(4)}`;
  else if (/^989\d{9}$/.test(compact)) canonical = `0${compact.slice(2)}`;
  else if (/^9\d{9}$/.test(compact)) canonical = `0${compact}`;

  return /^09\d{9}$/.test(canonical) ? canonical : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [phoneFieldError, setPhoneFieldError] = useState('');
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
    setPhoneFieldError('');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      const message = 'شماره همراه ایرانی معتبر وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.';
      setPhoneFieldError(message);
      setError(message);
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

      savePendingOtpFlow({
        phone: normalizedPhone,
        resendAvailableAt,
        step: 'code',
      });
      router.push('/verify-otp');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5" id="main-content" tabIndex={-1}>
      <section className="app-panel auth-card w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="auth-card-tools">
          <LoginBackButton />
          <ThemeToggle compact />
        </div>
        <BrandLogo
          className="mx-auto mb-4"
          priority
          size="auth-symbol"
          variant="symbol"
        />
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
            aria-invalid={Boolean(phoneFieldError)}
            aria-describedby={phoneFieldError ? 'phone-error' : undefined}
            onChange={(event) => {
              setPhone(event.target.value);
              setPhoneFieldError('');
            }}
            placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
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
          <p
            className="mt-4 rounded-lg bg-red-50 p-3 text-red-800"
            id={phoneFieldError ? 'phone-error' : undefined}
            role="alert"
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function LoginBackButton() {
  const router = useRouter();

  function goBack() {
    const referrer = document.referrer;
    if (referrer) {
      try {
        const previousUrl = new URL(referrer);
        const currentUrl = new URL(window.location.href);
        const previousPath = previousUrl.pathname.replace(/\/+$/, '') || '/';
        if (
          previousUrl.origin === currentUrl.origin &&
          previousPath !== '/login' &&
          previousPath !== '/verify-otp'
        ) {
          window.history.back();
          return;
        }
      } catch {
        // An invalid referrer falls back to the public home page.
      }
    }
    router.replace('/');
  }

  return (
    <AuthBackButton onClick={goBack} />
  );
}
