import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { error, fetchMetrics, fetchWithRecovery, loading, metricsError, RequestTimeoutError } from './store.ts';

const ok = () => new Response('{}', { status: 200 });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchWithRecovery', () => {
  it('repeats a read that got no answer, and returns the answer', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    const res = fetchWithRecovery('https://api.test/x');
    await vi.runAllTimersAsync();
    expect((await res).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after three tries', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    const res = fetchWithRecovery('https://api.test/x').catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await res).toBeInstanceOf(TypeError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('never repeats a write', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchWithRecovery('https://api.test/x', { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ends a request that never answers with a timeout error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_r, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const res = fetchWithRecovery('https://api.test/x').catch((e) => e);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await res).toBeInstanceOf(RequestTimeoutError);
  });
});

describe('a failed pipeline snapshot', () => {
  it('reports its own error and leaves the Board\'s load state alone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"boom"}', { status: 500 })));
    loading.set(true);
    await fetchMetrics();
    expect(get(metricsError)).toBe('boom');
    expect(get(error)).toBeNull();
    expect(get(loading)).toBe(true);
    loading.set(false);
  });
});
