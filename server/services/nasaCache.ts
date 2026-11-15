export type CacheState = 'hit' | 'miss' | 'stale' | 'fallback';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface CachedResult<T> {
  data: T;
  cache: CacheState;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Small in-memory cache for the three NASA proxies.
 *
 * - Concurrent cache misses share a single upstream call (coalescing).
 * - A failed refresh serves the last good payload as `stale` before the static
 *   fallback is used.
 * - Nothing is persisted; a restart simply refetches.
 */
export class NasaCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CachedResult<unknown>>>();

  constructor(private readonly now: () => number) {}

  get<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
    fallback: () => T
  ): Promise<CachedResult<T>> {
    const timestamp = this.now();
    const entry = this.entries.get(key);
    if (entry && timestamp < entry.expiresAt) {
      return Promise.resolve({ data: entry.value as T, cache: 'hit' });
    }

    const existingCall = this.inFlight.get(key);
    if (existingCall) {
      return existingCall as Promise<CachedResult<T>>;
    }

    const call = this.load<T>(key, ttlMs, load, fallback).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, call as Promise<CachedResult<unknown>>);
    return call;
  }

  private async load<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
    fallback: () => T
  ): Promise<CachedResult<T>> {
    try {
      const value = await load();
      this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
      return { data: value, cache: 'miss' };
    } catch {
      const stale = this.entries.get(key);
      if (stale) {
        return { data: stale.value as T, cache: 'stale' };
      }
      return { data: fallback(), cache: 'fallback' };
    }
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }
}
