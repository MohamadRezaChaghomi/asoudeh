'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeDollarSign,
  ChartNoAxesCombined,
  CircleUserRound,
  HandCoins,
  LayoutDashboard,
  Moon,
  PiggyBank,
  Settings,
  Sun,
  Volume2,
  VolumeX,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { href: '/dashboard', label: 'نمای کلی', icon: LayoutDashboard },
  { href: '/transactions', label: 'تراکنش‌ها', icon: WalletCards },
  { href: '/categories', label: 'دسته‌ها', icon: BadgeDollarSign },
  { href: '/budgets', label: 'بودجه‌ها', icon: PiggyBank },
  { href: '/reminders', label: 'یادآورها', icon: HandCoins },
  { href: '/reports', label: 'گزارش‌ها', icon: ChartNoAxesCombined },
  { href: '/caregiver', label: 'همراهان', icon: UsersRound },
  { href: '/settings', label: 'تنظیمات', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeechMessage('');
    return () => window.speechSynthesis.cancel();
  }, [pathname]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('asoudeh.theme');
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('asoudeh.theme', nextTheme);
    setTheme(nextTheme);
  }

  function togglePageSpeech() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechMessage('خواندن صوتی در این مرورگر پشتیبانی نمی‌شود؛ از صفحه‌خوان سیستم استفاده کنید.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeechMessage('خواندن متن متوقف شد.');
      return;
    }

    const voice = window.speechSynthesis
      .getVoices()
      .find(({ lang }) => /^fa(?:-|$)/i.test(lang));
    if (!voice) {
      setSpeechMessage('صدای فارسی در مرورگر یا سیستم شما در دسترس نیست.');
      return;
    }

    const text = document.querySelector<HTMLElement>('.app-content')?.innerText.trim();
    if (!text) {
      setSpeechMessage('متنی برای خواندن در این صفحه پیدا نشد.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang || 'fa-IR';
    utterance.voice = voice;
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeechMessage('خواندن متن صفحه تمام شد.');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechMessage('خواندن متن ممکن نشد؛ از صفحه‌خوان سیستم استفاده کنید.');
    };

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechMessage('خواندن متن ممکن نشد؛ از صفحه‌خوان سیستم استفاده کنید.');
      return;
    }
    setIsSpeaking(true);
    setSpeechMessage('خواندن متن صفحه آغاز شد.');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="ناوبری اصلی">
        <Link className="app-brand" href="/dashboard" aria-label="آسوده، نمای کلی">
          <BrandLogo size="sidebar" />
        </Link>

        <p className="sidebar-eyebrow">مدیریت مالی</p>
        <nav className="sidebar-nav">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn('sidebar-link', active && 'is-active')}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <span className="sidebar-note-icon" aria-hidden="true">
            <CircleUserRound size={18} />
          </span>
          <p>اطلاعات مالی شما خصوصی و فقط در اختیار خودتان است.</p>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="topbar-context">
            <span className="topbar-kicker">فضای شخصی</span>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="topbar-current">
              {navigation.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
                ?.label ?? 'آسوده'}
            </span>
          </div>
          <button
            aria-label={theme === 'dark' ? 'فعال‌کردن پوسته روشن' : 'فعال‌کردن پوسته تیره'}
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'پوسته روشن' : 'پوسته تیره'}</span>
          </button>
          <button
            aria-describedby="page-reader-help"
            aria-pressed={isSpeaking}
            className="theme-toggle"
            onClick={togglePageSpeech}
            type="button"
          >
            {isSpeaking ? (
              <VolumeX aria-hidden="true" size={18} />
            ) : (
              <Volume2 aria-hidden="true" size={18} />
            )}
            <span>{isSpeaking ? 'توقف خواندن' : 'خواندن متن صفحه'}</span>
          </button>
          <p className="sr-only" id="page-reader-status" aria-atomic="true" aria-live="polite">
            {speechMessage}
          </p>
          <span className="sr-only" id="page-reader-help">
            متن قابل مشاهده با صدای فارسی سیستم خوانده می‌شود؛ اگر از صفحه‌خوان استفاده می‌کنید،
            هم‌زمانی گفتار ممکن است باعث دوبارخوانی شود.
          </span>
        </header>

        <div className="app-content">{children}</div>
      </div>

      <nav className="mobile-nav" aria-label="ناوبری اصلی">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn('mobile-nav-link', active && 'is-active')}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
