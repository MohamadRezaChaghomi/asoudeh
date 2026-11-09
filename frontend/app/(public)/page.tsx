import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'مدیریت مالی شخصی | آسوده',
  description: 'درآمدها، هزینه‌ها، بودجه‌ها و یادآورها را در محیطی فارسی و دسترس‌پذیر مدیریت کنید.',
};

export default function HomePage() {
  return (
    <main className="public-main public-home" id="public-main">
      <section aria-labelledby="public-home-title" className="public-home-intro">
        <p className="public-eyebrow">مدیریت مالی شخصی، مخصوص سالمندان</p>
        <h1 id="public-home-title">مدیریت مالی ساده و قابل اعتماد</h1>
        <p className="public-page-description">
          درآمدها، هزینه‌ها، بودجه‌ها و یادآورها را در یک محیط فارسی و دسترس‌پذیر ثبت و مرور کنید.
          آسوده برای ساده‌ترشدن مدیریت روزمره امور مالی طراحی شده است.
        </p>
        <div className="public-home-actions">
          <Link className="public-login-link" href="/login">
            ورود یا ساخت حساب
          </Link>
          <Link className="public-home-guide" href="/guide">
            آشنایی با امکانات آسوده
          </Link>
        </div>
      </section>
    </main>
  );
}
