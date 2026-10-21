import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'آسوده | مدیریت مالی شخصی',
    short_name: 'آسوده',
    description: 'مدیریت ساده و دسترس‌پذیر امور مالی شخصی',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0f2747',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      {
        src: '/icons/asoudeh.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
