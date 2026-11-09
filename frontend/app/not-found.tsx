import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center" dir="rtl">
      <h1 className="text-2xl font-bold">صفحه پیدا نشد</h1>
      <p className="my-4">نشانی واردشده معتبر نیست یا صفحه جابه‌جا شده است.</p>
      <Link className="underline" href="/">
        بازگشت به صفحهٔ اصلی
      </Link>
    </main>
  );
}
