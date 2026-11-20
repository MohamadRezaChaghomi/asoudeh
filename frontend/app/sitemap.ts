import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

const publicPaths = ['/', '/about', '/guide', '/faq'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
