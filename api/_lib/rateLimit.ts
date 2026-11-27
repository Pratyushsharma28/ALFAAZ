import { ApiHttpError, type NodeHttpRequest } from './httpUtils.js';

interface BucketEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, BucketEntry>>();
let lastPrunedAt = Date.now();

function pruneOldEntries(now: number): void {
  if (now - lastPrunedAt < 5 * 60 * 1000) return;
  lastPrunedAt = now;

  for (const [, bucketMap] of stores) {
    for (const [key, entry] of bucketMap) {
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 60 * 60 * 1000) {
        bucketMap.delete(key);
      }
    }
  }
}

export function getClientIp(req: NodeHttpRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof rawForwarded === 'string' && rawForwarded.trim().length > 0) {
    return rawForwarded.split(',')[0].trim().slice(0, 80);
  }

  const realIp = req.headers['x-real-ip'];
  const rawRealIp = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof rawRealIp === 'string' && rawRealIp.trim().length > 0) {
    return rawRealIp.trim().slice(0, 80);
  }

  return req.socket?.remoteAddress || 'unknown';
}

export interface RateLimitCheckOptions {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
  errorMessage?: string;
}

export function enforceRateLimit(options: RateLimitCheckOptions): {
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  pruneOldEntries(now);

  let namespaceMap = stores.get(options.namespace);
  if (!namespaceMap) {
    namespaceMap = new Map<string, BucketEntry>();
    stores.set(options.namespace, namespaceMap);
  }

  const normalizedKey = options.key.trim().toLowerCase() || 'anonymous';
  const entry = namespaceMap.get(normalizedKey) ?? { timestamps: [] };
  const windowStart = now - options.windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= options.maxRequests) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestInWindow + options.windowMs - now) / 1000)
    );
    namespaceMap.set(normalizedKey, entry);

    throw new ApiHttpError(
      429,
      options.errorMessage ||
        `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`,
      'RATE_LIMITED'
    );
  }

  entry.timestamps.push(now);
  namespaceMap.set(normalizedKey, entry);

  return {
    remaining: Math.max(0, options.maxRequests - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}
