type CacheEntry = { at: number; data: unknown };

const cache = new Map<string, CacheEntry>();

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 45_000
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data as T;
  }
  const data = await fetcher();
  cache.set(key, { at: Date.now(), data });
  return data;
}
