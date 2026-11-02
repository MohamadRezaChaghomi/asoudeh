import Link from 'next/link';
import type { Metadata } from 'next';
import { FaqSearch } from '@/components/public/FaqSearch';

export const metadata: Metadata = {
  title: 'سؤالات متداول | آسوده',
  description: 'پاسخ پرسش‌های رایج درباره حساب، درآمد و هزینه، بودجه، گزارش و یادآورها در آسوده.',
};

export default function FaqPage() {
  return (
    <main className="public-main" id="public-main">
      <article className="public-article">
        <nav aria-label="مسیر صفحه" className="public-breadcrumbs">
          <Link href="/">صفحه اصلی</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">سؤالات متداول</span>
        </nav>
        <header className="public-page-heading">
          <p className="public-eyebrow">پاسخ‌های کوتاه و کاربردی</p>
          <h1>سؤالات متداول</h1>
          <p className="public-page-description">
            پاسخ‌ها بر اساس امکانات فعلی آسوده تهیه شده‌اند. برای پیدا کردن موضوع، در پرسش‌ها و
            پاسخ‌ها جست‌وجو کنید.
          </p>
        </header>
        <FaqSearch />
        <nav aria-label="صفحات مرتبط" className="public-related-links">
          <h2>پاسخ بیشتری می‌خواهید؟</h2>
          <ul>
            <li><Link href="/guide">راهنمای گام‌به‌گام آسوده</Link></li>
            <li><Link href="/contact">اطلاعات تماس</Link></li>
          </ul>
        </nav>
      </article>
    </main>
  );
}
