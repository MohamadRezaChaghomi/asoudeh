'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import {
  clearPendingOtpFlow,
  readPendingOtpFlow,
  savePendingOtpFlow,
  type PendingOtpFlow,
} from '@/lib/auth/otpFlow';
import { normalizeDigits } from '@/lib/normalizeDigits';

interface OtpResponseData {
  data: {
    resendAfterSeconds?: number;
    registrationRequired?: boolean;
  };
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}••••${phone.slice(-3)}`;
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<PendingOtpFlow | null>(null);
  const [flowLoaded, setFlowLoaded] = useState(false);
  const [code, setCode] = useState('');
  const [codeFieldError, setCodeFieldError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const pendingFlow = readPendingOtpFlow();
    if (!pendingFlow) {
      router.replace('/login');
      return;
    }

    setFlow(pendingFlow);
    setFlowLoaded(true);
  }, [router]);

  useEffect(() => {
    if (!flow) return;

    const updateCountdown = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((flow.resendAvailableAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [flow]);

  async function resendCode() {
    if (!flow || loading || remainingSeconds > 0) return;

    setError('');
    setLoading(true);
    try {
      const response = await api.post<OtpResponseData>('/auth/otp/request', {
        phone: flow.phone,
      });
      const responseData = response.data.data;
      const resendAfterSeconds =
        typeof responseData?.resendAfterSeconds === 'number'
          ? responseData.resendAfterSeconds
          : 60;
      const updatedFlow: PendingOtpFlow = {
        ...flow,
        resendAvailableAt: Date.now() + resendAfterSeconds * 1000,
        step: 'code',
      };

      savePendingOtpFlow(updatedFlow);
      setFlow(updatedFlow);
      setCode('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flow || loading) return;

    setError('');
    setCodeFieldError('');
    const normalizedCode = normalizeDigits(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      const message = 'کد تأیید باید شامل ۶ رقم باشد.';
      setCodeFieldError(message);
      setError(message);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<OtpResponseData>('/auth/otp/verify', {
        phone: flow.phone,
        code: normalizedCode,
      });

      if (response.data.data?.registrationRequired) {
        const registrationFlow: PendingOtpFlow = {
          ...flow,
          step: 'register',
        };
        savePendingOtpFlow(registrationFlow);
        setFlow(registrationFlow);
        setCode('');
        return;
      }

      clearPendingOtpFlow();
      router.replace('/dashboard');
    } catch (verifyError) {
      setError(getApiErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  }

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);
    try {
      await ensureCsrfToken();
      await api.post('/auth/register/complete', { displayName });
      clearPendingOtpFlow();
      router.replace('/dashboard');
    } catch (registrationError) {
      setError(getApiErrorMessage(registrationError));
    } finally {
      setLoading(false);
    }
  }

  function returnToLogin() {
    clearPendingOtpFlow();
    router.replace('/login');
  }

  if (!flowLoaded || !flow) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5" id="main-content" tabIndex={-1} aria-live="polite">
        <p className="app-muted">در حال آماده‌سازی تأیید…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5" id="main-content" tabIndex={-1}>
      <section className="app-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <BrandLogo
          className="mx-auto mb-4"
          priority
          size="auth-symbol"
          variant="symbol"
        />
        <p className="app-muted text-sm">مدیریت مالی شخصی سالمندان</p>
        <h1 className="mt-2 text-2xl font-bold text-asoudeh-navy">
          {flow.step === 'register' ? 'ساخت حساب کاربری' : 'تأیید شماره همراه'}
        </h1>

        {flow.step === 'code' ? (
          <form className="mt-6 space-y-4" noValidate onSubmit={verifyCode}>
            <p className="app-muted">
              کد شش‌رقمی ارسال‌شده به <bdi dir="ltr">{maskPhone(flow.phone)}</bdi> را وارد کنید.
            </p>
            <p className="app-muted text-sm">کد تا ۵ دقیقه معتبر است.</p>
            <label className="block font-medium" htmlFor="otp">
              کد تأیید
            </label>
            <input
              autoComplete="one-time-code"
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4 text-center text-xl tracking-[0.4em]"
              dir="ltr"
              id="otp"
              inputMode="numeric"
              maxLength={6}
              aria-invalid={Boolean(codeFieldError)}
              aria-describedby={codeFieldError ? 'otp-error' : undefined}
              onChange={(event) => {
                setCodeFieldError('');
                setCode(normalizeDigits(event.target.value).replace(/\D/g, '').slice(0, 6));
              }}
              pattern="[0-9]{6}"
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
              disabled={loading || remainingSeconds > 0}
              onClick={() => void resendCode()}
              type="button"
            >
              {remainingSeconds > 0
                ? `ارسال دوباره کد (${new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(Math.floor(remainingSeconds / 60))}:${new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(remainingSeconds % 60)})`
                : 'ارسال دوباره کد'}
            </button>
          </form>
        ) : (
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

        <button
          className="mt-3 w-full rounded-lg border border-slate-300 px-4 font-medium"
          disabled={loading}
          onClick={returnToLogin}
          type="button"
        >
          تغییر شماره همراه
        </button>

        {error && (
          <p
            className="mt-4 rounded-lg bg-red-50 p-3 text-red-800"
            id={codeFieldError ? 'otp-error' : undefined}
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
