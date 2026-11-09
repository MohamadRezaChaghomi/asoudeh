'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';
import { formatTomanAmountInput, parseTomanAmount } from '@/lib/tomanAmount';

interface ProfileResponse {
  data: {
    profile: { id: string; initialBalance: number };
  };
}

const WELCOME_FLAG = 'asoudeh.welcomeCompleted.v1';

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await api.get<ProfileResponse>('/me');
        const profile = response.data.data.profile;
        if (!active) return;
        setProfileId(profile.id);
        setInitialBalance(
          profile.initialBalance > 0 ? formatTomanAmountInput(String(profile.initialBalance)) : '',
        );
        if (window.localStorage.getItem(`${WELCOME_FLAG}.${profile.id}`) === 'done') {
          router.replace('/dashboard');
        }
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

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  function finish(destination: '/dashboard' | '/transactions') {
    try {
      window.localStorage.setItem(`${WELCOME_FLAG}.${profileId}`, 'done');
    } catch {
      setError('ذخیرهٔ وضعیت راهنما در مرورگر انجام نشد؛ دوباره تلاش کنید.');
      return;
    }
    router.replace(destination === '/transactions' ? '/transactions#transaction-form' : destination);
  }

  async function continueToTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const amount = initialBalance.trim() ? parseTomanAmount(initialBalance) : undefined;
    if (initialBalance.trim() && amount === undefined) {
      setError('موجودی را به‌صورت عدد صحیح و غیرمنفی وارد کنید.');
      return;
    }

    if (amount !== undefined) {
      setSaving(true);
      try {
        await ensureCsrfToken();
        await api.patch('/me/profile', { initialBalance: amount });
      } catch (saveError) {
        setError(getApiErrorMessage(saveError));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setStep(3);
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5" id="main-content" tabIndex={-1} aria-live="polite">
        <p className="app-muted mx-auto max-w-xl">در حال آماده‌سازی راهنما…</p>
      </main>
    );
  }

  if (!profileId) {
    return (
      <main className="min-h-screen p-5" id="main-content" tabIndex={-1}>
        <section className="app-panel mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-red-800" role="alert">{error || 'اطلاعات حساب بارگذاری نشد.'}</p>
          <button
            className="mt-4 min-h-12 rounded-lg border border-slate-300 px-4 font-medium"
            onClick={() => window.location.reload()}
            type="button"
          >
            تلاش دوباره
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-8" id="main-content" tabIndex={-1}>
      <section className="app-panel mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="app-muted text-sm">شروع آسوده</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-asoudeh-navy sm:text-3xl">خوش آمدید</h1>
          <span className="app-muted" aria-live="polite">مرحلهٔ {step} از ۳</span>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}

        {step === 1 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold">مدیریت مالی، ساده و روشن</h2>
            <p className="app-muted mt-3">
              هزینه‌ها، درآمدها، بودجه‌ها و سررسیدها را در یک جا ببینید.
            </p>
            <Link className="mt-4 inline-flex min-h-12 items-center rounded-lg underline" href="/guide">
              دیدن راهنمای برنامه
            </Link>
            <button
              className="mt-5 block min-h-12 w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white"
              onClick={() => setStep(2)}
              type="button"
            >
              ادامه
            </button>
          </div>
        )}

        {step === 2 && (
          <form className="mt-6 space-y-4" onSubmit={(event) => void continueToTransaction(event)}>
            <h2 className="text-xl font-bold">موجودی آغازین (اختیاری)</h2>
            <p className="app-muted">اگر می‌خواهید، موجودی فعلی را وارد کنید؛ می‌توانید رد کنید.</p>
            <label className="block font-medium" htmlFor="welcome-balance">مبلغ به تومان</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
              dir="ltr"
              id="welcome-balance"
              inputMode="numeric"
              onChange={(event) => setInitialBalance(formatTomanAmountInput(event.target.value))}
              placeholder="۰"
              value={initialBalance}
            />
            <div className="flex flex-wrap gap-3">
              <button
                className="min-h-12 flex-1 rounded-lg bg-asoudeh-navy px-4 font-semibold text-white disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? 'در حال ذخیره…' : 'ادامه'}
              </button>
              <button
                className="min-h-12 flex-1 rounded-lg border border-slate-300 px-4 font-medium"
                onClick={() => {
                  setInitialBalance('');
                  setStep(3);
                }}
                type="button"
              >
                رد کردن
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold">اولین تراکنش را ثبت کنید</h2>
            <p className="app-muted mt-3">
              یک درآمد یا هزینه اضافه کنید تا نمای مالی شما کامل شود.
            </p>
            <Link className="mt-3 inline-flex min-h-12 items-center rounded-lg underline" href="/guide">
              راهنمای ثبت تراکنش
            </Link>
            <button
              className="mt-5 block min-h-12 w-full rounded-lg bg-asoudeh-navy px-4 font-semibold text-white"
              onClick={() => finish('/transactions')}
              type="button"
            >
              ثبت اولین تراکنش
            </button>
          </div>
        )}

        <button
          className="mt-4 min-h-12 w-full rounded-lg border border-slate-300 px-4 font-medium"
          onClick={() => finish('/dashboard')}
          type="button"
        >
          رد کردن راهنما
        </button>
      </section>
    </main>
  );
}
