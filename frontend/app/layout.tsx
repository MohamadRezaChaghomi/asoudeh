import type { Metadata } from 'next';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { ThemeInitializer } from '@/components/layout/ThemeInitializer';
import './globals.css';

export const metadata: Metadata = {
  title: 'آسوده',
  description: 'مدیریت مالی شخصی سالمندان',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <ThemeInitializer />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
