import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'آسوده | Asoudeh',
    short_name: 'آسوده',
    description: 'مدیریت ساده و دسترس‌پذیر امور مالی شخصی',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F7F2',
    theme_color: '#1F5C4A',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'ثبت تراکنش',
        short_name: 'تراکنش',
        description: 'ثبت یک درآمد یا هزینه',
        url: '/transactions?type=expense',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'دسته‌بندی‌ها',
        short_name: 'دسته‌ها',
        description: 'مدیریت دسته‌های مالی',
        url: '/categories',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
