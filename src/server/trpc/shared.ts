function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

export function getUrl() {
  return getBaseUrl() + '/api/trpc';
}
