const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

export const siteUrl = new URL(
  process.env.NODE_ENV === 'production' && configuredApiUrl
    ? new URL(configuredApiUrl).origin
    : 'http://localhost:3000',
);
