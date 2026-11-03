import { describe, expect, it, vi } from 'vitest';
import { cachedRequest, invalidateRequests, requestAge } from './requestCache.ts';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('requestCache', () => {
  it('shares one in-flight request between concurrent callers', async () => {
    invalidateRequests();
    const fn = vi.fn(() => Promise.resolve(42));
    const [a, b] = await Promise.all([cachedRequest('k1', fn), cachedRequest('k1', fn)]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serves a settled answer within the TTL and refetches after it', async () => {
    invalidateRequests();
    vi.useFakeTimers();
    const fn = vi.fn(() => Promise.resolve('v'));
    await cachedRequest('k2', fn, { ttl: 1000 });
    await cachedRequest('k2', fn, { ttl: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await cachedRequest('k2', fn, { ttl: 1000 });
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('fresh bypasses the cache', async () => {
    invalidateRequests();
    const fn = vi.fn(() => Promise.resolve(1));
    await cachedRequest('k3', fn);
    await cachedRequest('k3', fn, { fresh: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache a response that lands after invalidation', async () => {
    invalidateRequests();
    const d = deferred<string>();
    const p = cachedRequest('sales:x', () => d.promise);
    invalidateRequests('sales:');
    d.resolve('old');
    expect(await p).toBe('old');
    expect(requestAge('sales:x')).toBe(Infinity);
  });

  it('forgets failures so the next call retries', async () => {
    invalidateRequests();
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    await expect(cachedRequest('k4', fn)).rejects.toThrow('boom');
    await expect(cachedRequest('k4', fn)).resolves.toBe('ok');
  });
});
