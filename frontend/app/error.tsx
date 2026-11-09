'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application route error');
  }, []);

  return (
    <main className="mx-auto max-w-xl p-8 text-center" dir="rtl" id="main-content" tabIndex={-1}>
      <h1 className="text-2xl font-bold">مشکلی پیش آمد</h1>
      <p className="my-4">بارگذاری این صفحه با مشکل روبه‌رو شد. دوباره تلاش کنید.</p>
      <button className="rounded-lg border px-4 py-2" onClick={reset} type="button">
        تلاش دوباره
      </button>
    </main>
  );
}
