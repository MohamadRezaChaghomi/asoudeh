import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { AccessibilityNavigation } from '@/components/AccessibilityNavigation';
import './globals.css';

const vazirmatn = localFont({
  src: '../node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-vazirmatn',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C',
    },
  ],
});

export const metadata: Metadata = {
  applicationName: 'آسوده | Asoudeh',
  title: {
    default: 'آسوده | Asoudeh',
    template: '%s | آسوده',
  },
  description: 'مدیریت مالی شخصی، ساده و دسترس‌پذیر به زبان فارسی',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#1F5C4A',
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={vazirmatn.variable} lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`try { document.documentElement.dataset.theme = localStorage.getItem('asoudeh.theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }`}
        </Script>
      </head>
      <body>
        <AccessibilityNavigation />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
