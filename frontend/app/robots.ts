import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/guide', '/faq'],
      disallow: [
        '/login',
        '/verify-otp',
        '/dashboard',
        '/transactions',
        '/categories',
        '/budgets',
        '/reports',
        '/reminders',
        '/caregiver',
        '/settings',
        '/welcome',
      ],
    },
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  };
}
