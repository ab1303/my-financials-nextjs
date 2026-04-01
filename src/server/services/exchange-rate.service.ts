/**
 * Exchange Rate Service
 * Fetches live USD→AUD rate from open.er-api.com with 1-hour in-memory cache.
 * Falls back to a hardcoded rate if the API is unreachable.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_USD_TO_AUD = 1.55;
const API_URL = 'https://open.er-api.com/v6/latest/USD';

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

let cachedRate: CachedRate | null = null;

export async function getUSDtoAUDRate(): Promise<number> {
  const now = Date.now();

  // Return cached value if fresh
  if (cachedRate && now - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 }, // Next.js cache hint
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      rates?: Record<string, number>;
    };

    const audRate = data?.rates?.AUD;

    if (typeof audRate !== 'number' || audRate <= 0) {
      throw new Error('Invalid AUD rate in API response');
    }

    cachedRate = { rate: audRate, fetchedAt: now };
    return audRate;
  } catch (error) {
    console.warn(
      '[exchange-rate] Failed to fetch live rate, using fallback:',
      error,
    );

    // Prefer stale cache over hardcoded fallback
    if (cachedRate) {
      return cachedRate.rate;
    }

    return FALLBACK_USD_TO_AUD;
  }
}

/**
 * Convert USD amount to AUD.
 */
export async function convertUSDtoAUD(usdAmount: number): Promise<{
  audAmount: number;
  rate: number;
}> {
  const rate = await getUSDtoAUDRate();
  return {
    audAmount: usdAmount * rate,
    rate,
  };
}
