import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm">
        <BrandLogo className="mb-5" size="landing" />
        <h1 className="text-3xl font-bold text-asoudeh-navy">مدیریت مالی ساده و قابل اعتماد</h1>
        <p className="mt-4 text-slate-600">
          درآمدها، هزینه‌ها، بودجه‌ها و یادآورها را در یک محیط فارسی و دسترس‌پذیر مدیریت کنید.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-asoudeh-navy px-6 py-3 font-bold text-white"
        >
          ورود
        </Link>
      </section>
    </main>
  );
}
