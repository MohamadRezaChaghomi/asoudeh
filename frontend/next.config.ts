import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (isProduction && !configuredApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured with HTTPS in production.');
}

const apiUrl = new URL(configuredApiUrl || 'http://localhost:5000/api/v1');
if (isProduction && apiUrl.protocol !== 'https:') {
  throw new Error('NEXT_PUBLIC_API_URL must use HTTPS in production.');
}
if (apiUrl.username || apiUrl.password) {
  throw new Error('NEXT_PUBLIC_API_URL must not contain credentials.');
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl.origin}`,
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
