'use client';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-8 text-center" dir="rtl" id="main-content" tabIndex={-1}>
      <h1 className="text-2xl font-bold">بارگذاری صفحه انجام نشد</h1>
      <p className="my-4">مشکلی پیش آمد. دوباره تلاش کنید.</p>
      <button className="rounded-lg border px-4 py-2" onClick={reset} type="button">
        تلاش دوباره
      </button>
    </main>
  );
}
