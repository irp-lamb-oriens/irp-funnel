/**
 * requestCache — tiny in-memory read cache for the dashboard's heavy GETs.
 *
 * Two jobs:
 *  1. De-duplicate concurrent reads. Metrics, Sales Book and Evo all ask for
 *     the same lead cube; opening them in quick succession used to fire one
 *     request each. Now they share the in-flight promise.
 *  2. Serve a recent answer instantly. Within `ttl` a repeat read resolves from
 *     memory, so a remount (deep link, re-login) paints without a spinner. The
 *     default TTL matches the server's own 30 s sources cache, so the figures
 *     are never older than what a network round-trip would have returned.
 *
 * Writes call `invalidateRequests(prefix)` so the next read goes to the server.
 * A response that lands after its key was invalidated is returned to its caller
 * but never cached, which keeps a pre-save read from resurrecting old totals.
 */

type Entry = { at: number; value?: unknown; has: boolean; promise?: Promise<unknown> };

const entries = new Map<string, Entry>();

export interface CacheOptions {
  /** Max age (ms) of a settled answer that may be reused. */
  ttl?: number;
  /** Skip the cache and replace whatever is there. */
  fresh?: boolean;
}

export function cachedRequest<T>(key: string, fn: () => Promise<T>, opts: CacheOptions = {}): Promise<T> {
  const ttl = opts.ttl ?? 30_000;
  const hit = entries.get(key);
  if (!opts.fresh && hit) {
    if (hit.promise) return hit.promise as Promise<T>;
    if (hit.has && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T);
  }
  const p: Promise<T> = fn().then(
    (value) => {
      if (entries.get(key)?.promise === p) entries.set(key, { at: Date.now(), value, has: true });
      return value;
    },
    (err) => {
      if (entries.get(key)?.promise === p) entries.delete(key);
      throw err;
    },
  );
  entries.set(key, { at: Date.now(), has: false, promise: p });
  return p;
}

/** Drop every cached read whose key starts with `prefix` (all when empty). */
export function invalidateRequests(prefix = ''): void {
  for (const k of [...entries.keys()]) if (k.startsWith(prefix)) entries.delete(k);
}

/** Age in ms of the settled answer for `key`, or Infinity when there is none. */
export function requestAge(key: string): number {
  const e = entries.get(key);
  return e?.has ? Date.now() - e.at : Infinity;
}
