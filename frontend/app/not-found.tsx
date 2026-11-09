import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PublicPagesLayout } from '@/components/public/PublicPagesLayout';

export default function NotFound() {
  return (
    <PublicPagesLayout>
      <main className="public-main" dir="rtl" id="main-content" tabIndex={-1}>
        <section className="app-panel mx-auto max-w-xl rounded-2xl p-8 text-center sm:p-12">
          <BrandLogo
            alt="نشان آسوده"
            className="mx-auto mb-6"
            size="auth-symbol"
            variant="symbol"
          />
          <p className="app-muted text-sm font-semibold">خطای ۴۰۴</p>
          <h1 className="mt-2 text-3xl font-bold text-asoudeh-navy">این صفحه پیدا نشد</h1>
          <p className="app-muted mx-auto mt-4 max-w-md">
            شاید نشانی تغییر کرده باشد. می‌توانید به نمای کلی برگردید یا از صفحهٔ اصلی شروع کنید.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-asoudeh-navy px-5 font-semibold text-white"
              href="/dashboard"
            >
              بازگشت به نمای کلی
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--border-strong)] px-5 font-medium text-[var(--text)]"
              href="/"
            >
              صفحهٔ اصلی
            </Link>
          </div>
        </section>
      </main>
    </PublicPagesLayout>
  );
}
