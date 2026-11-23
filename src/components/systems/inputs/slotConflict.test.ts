import { describe, expect, it } from 'vitest';
import { isBeforeMinimumNotice, MINIMUM_NOTICE_MS } from './slotConflict.ts';

const HOUR_MS = 60 * 60 * 1000;
const NOW_MS = Date.parse('2026-11-23T15:00:00.000Z');

describe('minimum notice for booking a call', () => {
  it('is 3 hours', () => {
    expect(MINIMUM_NOTICE_MS).toBe(3 * HOUR_MS);
  });

  it('rejects a slot that starts less than 3 hours from now', () => {
    expect(isBeforeMinimumNotice(NOW_MS + 3 * HOUR_MS - 1, NOW_MS)).toBe(true);
  });

  it('accepts a slot that starts 3 hours from now or later', () => {
    expect(isBeforeMinimumNotice(NOW_MS + 3 * HOUR_MS, NOW_MS)).toBe(false);
  });
});
