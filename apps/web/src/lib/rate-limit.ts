/**
 * Oddiy in-memory rate limiter (login brute-force himoyasi).
 *
 * Eslatma: bir nechta server instansiyasida umumiy emas. Productionda
 * Redis/Upstash kabi markaziy store ishlatish tavsiya etiladi.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  success: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { success: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { success: true, retryAfterSeconds: 0 };
}

/** Xotira to'planishining oldini olish uchun vaqti o'tgan yozuvlarni tozalash */
export function cleanupRateLimitBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
