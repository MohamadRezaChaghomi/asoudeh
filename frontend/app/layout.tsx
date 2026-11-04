import type { Metadata } from 'next';
import Script from 'next/script';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

export const metadata: Metadata = {
  title: 'آسوده',
  description: 'مدیریت مالی شخصی سالمندان',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`try { document.documentElement.dataset.theme = localStorage.getItem('asoudeh.theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }`}
        </Script>
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
