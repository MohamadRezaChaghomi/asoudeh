'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="mx-auto max-w-xl p-8 text-center" id="main-content" tabIndex={-1}>
          <h1 className="text-2xl font-bold">خطای برنامه</h1>
          <p className="my-4">برنامه با مشکل روبه‌رو شد. دوباره تلاش کنید.</p>
          <button className="rounded-lg border px-4 py-2" onClick={reset} type="button">
            تلاش دوباره
          </button>
        </main>
      </body>
    </html>
  );
}
