import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';

const primaryLinks = [
  { href: '/guide', label: 'راهنما' },
  { href: '/faq', label: 'سؤالات متداول' },
  { href: '/about', label: 'درباره' },
];

const footerLinks = [
  { href: '/terms', label: 'قوانین و مقررات' },
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/faq', label: 'سؤالات متداول' },
  { href: '/about', label: 'درباره آسوده' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/guide', label: 'راهنمای استفاده' },
];

export function PublicPagesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="public-site">
      <Link className="public-skip-link" href="#public-main">
        رفتن به محتوای اصلی
      </Link>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link aria-label="آسوده، صفحه اصلی" className="public-brand" href="/">
          <BrandLogo className="public-brand-logo" size="landing" />
          <span>آسوده</span>
        </Link>
        <nav aria-label="ناوبری صفحات عمومی" className="public-desktop-nav">
          {primaryLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <Link className="public-login-link" href="/login">
          ورود به آسوده
        </Link>
        <details className="public-mobile-menu">
          <summary aria-label="بازکردن منوی صفحات عمومی">
            <span aria-hidden="true" className="public-menu-icon">
              <span />
              <span />
              <span />
            </span>
            <span className="public-sr-only">منو</span>
          </summary>
          <nav aria-label="منوی صفحات عمومی">
            {[...primaryLinks, { href: '/contact', label: 'تماس با ما' }].map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/login">ورود به آسوده</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-about">
          <Link aria-label="آسوده، صفحه اصلی" className="public-footer-brand" href="/">
            <BrandLogo className="public-footer-logo" size="landing" />
            آسوده
          </Link>
          <p>مدیریت مالی شخصی، ساده و فارسی.</p>
        </div>
        <nav aria-label="پیوندهای صفحات عمومی" className="public-footer-links">
          {footerLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="public-copyright">
          <span aria-hidden="true">©</span> آسوده
        </p>
      </div>
    </footer>
  );
}
