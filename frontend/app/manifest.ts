import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'آسوده | مدیریت مالی شخصی',
    short_name: 'آسوده',
    description: 'مدیریت ساده و دسترس‌پذیر امور مالی شخصی',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f6f5ef',
    theme_color: '#173d32',
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
