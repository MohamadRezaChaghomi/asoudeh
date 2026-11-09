import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { AccessibilityNavigation } from '@/components/AccessibilityNavigation';
import './globals.css';

const metadataBase = new URL(
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_API_URL
    ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
    : 'http://localhost:3000',
);

const estedadArabic = localFont({
  src: '../node_modules/@fontsource-variable/estedad/files/estedad-arabic-wght-normal.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-estedad-arabic',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC',
    },
  ],
});

const estedadLatin = localFont({
  src: '../node_modules/@fontsource-variable/estedad/files/estedad-latin-wght-normal.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-estedad-latin',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const estedadLatinExt = localFont({
  src: '../node_modules/@fontsource-variable/estedad/files/estedad-latin-ext-wght-normal.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-estedad-latin-ext',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
});

export const metadata: Metadata = {
  metadataBase,
  applicationName: 'آسوده | Asoudeh',
  title: {
    default: 'آسوده | Asoudeh',
    template: '%s | آسوده',
  },
  description: 'مدیریت مالی شخصی، ساده و دسترس‌پذیر به زبان فارسی',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'آسوده',
    title: 'آسوده | Asoudeh',
    description: 'مدیریت مالی شخصی، ساده و دسترس‌پذیر به زبان فارسی',
    images: [
      {
        url: '/preview/og-image.png',
        width: 1200,
        height: 630,
        alt: 'آسوده؛ امور مالی‌ات منظم، ذهنت آسوده',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/preview/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
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
    <html
      className={`${estedadArabic.variable} ${estedadLatin.variable} ${estedadLatinExt.variable}`}
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
    >
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
