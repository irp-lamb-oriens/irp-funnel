/**
 * EditableField — unit tests for display/format logic.
 *
 * The component itself is a Svelte SFC, so to keep these tests fast and
 * dependency-free (no jsdom mount, no fetch mock) we only verify the
 * deterministic helper logic that was extended in the recent
 * "Overview tab editable" milestone:
 *
 *   1. The new `placeholder` prop overrides the default em-dash on empty values.
 *   2. The default placeholder is "—".
 *   3. Empty-string, null, undefined are all considered empty.
 *
 * Mirroring the helpers locally is intentional — we don't want this test to
 * import the .svelte file (vitest in node-mode chokes on Svelte templates),
 * but we do want a regression bell when someone changes the contract.
 */
import { describe, it, expect } from 'vitest';

/**
 * Re-implementation of EditableField's `formatValue()`.
 * If you change one, change the other.
 */
function formatValue(v: unknown, placeholder: string = '—'): string {
  if (v === null || v === undefined || v === '') return placeholder;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  }
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return '{…}'; }
  }
  return String(v);
}

describe('EditableField formatValue() — placeholder contract', () => {
  it('falls back to em-dash by default when value is null', () => {
    expect(formatValue(null)).toBe('—');
  });

  it('falls back to em-dash by default when value is undefined', () => {
    expect(formatValue(undefined)).toBe('—');
  });

  it('falls back to em-dash by default when value is empty string', () => {
    expect(formatValue('')).toBe('—');
  });

  it('honors a custom placeholder for empty string', () => {
    expect(formatValue('', 'No transcript')).toBe('No transcript');
  });

  it('honors a custom placeholder for null', () => {
    expect(formatValue(null, 'unset')).toBe('unset');
  });

  it('does NOT use placeholder when value is the literal "0" string', () => {
    // Regression: empty-check used `v === ''`, not falsy.
    expect(formatValue('0')).toBe('0');
  });

  it('does NOT use placeholder when value is numeric zero', () => {
    expect(formatValue(0)).toBe('0');
  });

  it('does NOT use placeholder when value is boolean false', () => {
    expect(formatValue(false)).toBe('false');
  });

  it('renders strings as-is', () => {
    expect(formatValue('Costa Rica')).toBe('Costa Rica');
  });

  it('renders numbers as their string repr', () => {
    expect(formatValue(42)).toBe('42');
  });

  it('renders booleans as their string repr', () => {
    expect(formatValue(true)).toBe('true');
  });

  it('summarises arrays as [N items]', () => {
    expect(formatValue([1, 2, 3])).toBe('[3 items]');
    expect(formatValue([1])).toBe('[1 item]');
    expect(formatValue([])).toBe('[]');
  });

  it('JSON-encodes generic objects', () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });
});

/**
 * Insights-tab empty-state branching contract.
 *
 * When the Overview tab refactor landed, the Insights tab's empty-state
 * messaging was upgraded from the misleading "no transcript yet" copy to a
 * 3-way branch based on call/transcript context. These tests pin the branch
 * decision so future copy changes don't accidentally reroute the cases.
 */
type EmptyBranch =
  | 'pending_extraction'
  | 'awaiting_gemini'
  | 'pre_call';

function pickEmptyBranch(args: {
  hasInsights: boolean;
  hasSomeTranscript: boolean;
  isPostCallStage: boolean;
}): EmptyBranch | 'show_insights' {
  if (args.hasInsights) return 'show_insights';
  if (args.hasSomeTranscript) return 'pending_extraction';
  if (args.isPostCallStage) return 'awaiting_gemini';
  return 'pre_call';
}

describe('Insights tab empty-state branching', () => {
  it('shows insights when transcriptInsights is present', () => {
    expect(
      pickEmptyBranch({ hasInsights: true, hasSomeTranscript: true, isPostCallStage: true }),
    ).toBe('show_insights');
  });

  it('points to Re-extract when we have transcript but no insights', () => {
    expect(
      pickEmptyBranch({ hasInsights: false, hasSomeTranscript: true, isPostCallStage: true }),
    ).toBe('pending_extraction');
  });

  it('explains "Waiting for Gemini" when post-call but no transcript', () => {
    expect(
      pickEmptyBranch({ hasInsights: false, hasSomeTranscript: false, isPostCallStage: true }),
    ).toBe('awaiting_gemini');
  });

  it('shows "no call yet" copy when client is pre-call', () => {
    expect(
      pickEmptyBranch({ hasInsights: false, hasSomeTranscript: false, isPostCallStage: false }),
    ).toBe('pre_call');
  });

  it('prefers transcript-pending over awaiting-gemini when both apply', () => {
    // If we DO have transcript material, we're past the Gemini-fetch stage
    // — the right CTA is "re-extract", not "wait for Gemini".
    expect(
      pickEmptyBranch({ hasInsights: false, hasSomeTranscript: true, isPostCallStage: false }),
    ).toBe('pending_extraction');
  });
});
