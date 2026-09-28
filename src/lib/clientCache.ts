'use client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

// Default cache duration: 60 seconds
const DEFAULT_TTL_MS = 60 * 1000;

export const clientCache = {
  /**
   * Retrieves data from memory cache if available and within TTL.
   */
  get<T>(key: string, maxAgeMs: number = DEFAULT_TTL_MS): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
      return null;
    }
    return entry.data as T;
  },

  /**
   * Directly sets data in memory cache.
   */
  set<T>(key: string, data: T): void {
    memoryCache.set(key, { data, timestamp: Date.now() });
  },

  /**
   * Removes keys matching pattern or all if none provided.
   */
  invalidate(keyPattern?: string): void {
    if (!keyPattern) {
      memoryCache.clear();
      inFlightRequests.clear();
      return;
    }
    for (const key of memoryCache.keys()) {
      if (key.includes(keyPattern)) {
        memoryCache.delete(key);
      }
    }
    for (const key of inFlightRequests.keys()) {
      if (key.includes(keyPattern)) {
        inFlightRequests.delete(key);
      }
    }
  },

  /**
   * Fetch with cache + in-flight request deduplication.
   * Multiple calls to the same endpoint simultaneously will share 1 network request.
   */
  async fetchWithCache<T>(
    url: string,
    optionsOrTtl?: RequestInit | number,
    ttlMsParam?: number
  ): Promise<T> {
    const options = typeof optionsOrTtl === 'object' && optionsOrTtl !== null ? optionsOrTtl : undefined;
    const ttlMs = typeof optionsOrTtl === 'number' ? optionsOrTtl : (ttlMsParam ?? DEFAULT_TTL_MS);

    const cached = clientCache.get<T>(url, ttlMs);
    if (cached !== null) {
      return cached;
    }

    // Deduplicate in-flight promises
    if (inFlightRequests.has(url)) {
      return inFlightRequests.get(url)! as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        clientCache.set(url, data);
        return data as T;
      } finally {
        inFlightRequests.delete(url);
      }
    })();

    inFlightRequests.set(url, fetchPromise);
    return fetchPromise;
  }
};
