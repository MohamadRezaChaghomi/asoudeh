'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { api, ensureCsrfToken } from '@/lib/api/client';

const ACTIVITY_SYNC_INTERVAL_MS = 15_000;
const IDLE_WARNING_MS = 9 * 60 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export function SessionActivityMonitor() {
  const router = useRouter();
  const [idleWarning, setIdleWarning] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    let lastActivityAt = Date.now();
    let lastSyncAt = 0;
    let syncInProgress = false;
    let warningTimer: ReturnType<typeof setTimeout>;
    let expiryTimer: ReturnType<typeof setTimeout>;

    function scheduleIdleTimers() {
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
      const idleDuration = Date.now() - lastActivityAt;
      const warningRemaining = IDLE_WARNING_MS - idleDuration;
      if (warningRemaining <= 0) {
        setIdleWarning(true);
      } else {
        warningTimer = setTimeout(() => setIdleWarning(true), warningRemaining);
      }
      const expiryRemaining = IDLE_TIMEOUT_MS - idleDuration;
      expiryTimer = setTimeout(() => {
        void expireSession();
      }, Math.max(0, expiryRemaining));
    }

    async function expireSession() {
      try {
        await ensureCsrfToken();
        await api.post('/auth/logout');
      } catch {
        setConnectionError('نشست شما پایان یافت؛ برای ادامه دوباره وارد شوید.');
      } finally {
        router.replace('/login?session=expired');
      }
    }

    async function syncActivity() {
      if (syncInProgress) return;
      syncInProgress = true;
      lastSyncAt = Date.now();

      try {
        await ensureCsrfToken();
        await api.post('/auth/activity');
        setConnectionError('');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          router.replace('/login?session=expired');
          return;
        }
        lastSyncAt = 0;
        setConnectionError('ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.');
      } finally {
        syncInProgress = false;
      }
    }

    function recordHumanActivity(event: Event) {
      if (!event.isTrusted || document.visibilityState !== 'visible') return;

      lastActivityAt = Date.now();
      setIdleWarning(false);
      scheduleIdleTimers();
      if (lastActivityAt - lastSyncAt >= ACTIVITY_SYNC_INTERVAL_MS) {
        void syncActivity();
      }
    }

    const activityEvents = ['pointerdown', 'keydown', 'input', 'touchstart', 'scroll'];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordHumanActivity, { passive: true, capture: true }),
    );
    scheduleIdleTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordHumanActivity, true),
      );
    };
  }, [router]);

  if (!idleWarning && !connectionError) return null;

  return (
    <div className="mx-auto max-w-6xl px-5 pt-4">
      {idleWarning && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="status">
          به‌دلیل بی‌کاری، نشست شما تا یک دقیقه دیگر پایان می‌یابد. برای ادامه، در صفحه فعالیت کنید.
        </p>
      )}
      {connectionError && (
        <p className="mt-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
          {connectionError}
        </p>
      )}
    </div>
  );
}
