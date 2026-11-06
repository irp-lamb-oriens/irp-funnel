/**
 * Landing narrator logic (ported from ilp/frontend/src/lib/narration). Plain
 * functions, no DOM, so they can be unit-tested.
 *
 * Inputs: static/narration/home.mp3 and home.json (Whisper-shaped: words
 * with start/end in seconds). Word times come from the owner's phrase
 * times, snapped to the pauses in the audio, with syllable-weighted timing
 * inside each phrase (docs/narration/align.py).
 */

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface Transcript {
  duration: number;
  words: TimedWord[];
}

export interface Cue {
  id: string;
  /** Element id of the section this cue narrates. */
  anchor: string;
  /** Short name shown in the player. */
  label: string;
  /** Opening words to find in the transcript, in order after the previous cue. */
  match: string;
}

/** Home cues, in page order. The last one ends on the booking form (see Narrator). */
export const HOME_CUES: Cue[] = [
  { id: 'home-hero', anchor: 'hero-form', label: 'Book your call', match: "Hi, I'm Pablo" },
  { id: 'home-problem', anchor: 'problem', label: 'Before you move', match: 'The rules for your' },
  { id: 'home-how', anchor: 'how', label: 'How it works', match: 'We start with a' },
  { id: 'home-services', anchor: 'services', label: 'What we do', match: 'We handle international moves' },
  { id: 'home-lili', anchor: 'lili', label: 'Chat with Lili', match: "If you'd rather ask" },
  { id: 'home-principle', anchor: 'principle', label: 'A well-planned project', match: 'Every successful project starts' },
  { id: 'home-includes', anchor: 'includes', label: 'Your project', match: 'Your project comes with' },
  { id: 'home-timeline', anchor: 'timeline', label: 'Your timeline', match: 'Once you confirm, each' },
  { id: 'home-who', anchor: 'who', label: 'Who we serve', match: 'We work with expats' },
  { id: 'home-countries', anchor: 'countries', label: 'Six countries', match: 'Costa Rica, Panama, Mexico' },
  { id: 'home-reviews', anchor: 'reviews', label: 'Clients', match: 'Jill Reed moved with' },
  { id: 'home-faq', anchor: 'faq', label: 'Questions', match: 'The questions people ask' },
  { id: 'home-book', anchor: 'book', label: 'Book your call', match: "When you're ready, book" }
];

/* ── Transcript matching ─────────────────────────────────────── */

export const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Start time of each cue: the first place, after the previous cue, where its
 * opening words appear in order. A cue that is not found gets the midpoint
 * between its neighbours' times (filled afterwards).
 */
export function cueStarts(cues: Cue[], words: TimedWord[], duration: number): number[] {
  const toks = words.map((w) => norm(w.word));
  const out: (number | null)[] = [];
  let from = 0;
  for (const cue of cues) {
    const want = cue.match.split(/\s+/).map(norm).filter(Boolean);
    let found = -1;
    for (let k = from; k <= toks.length - want.length; k++) {
      if (want.every((w, j) => toks[k + j] === w)) {
        found = k;
        break;
      }
    }
    if (found >= 0) {
      out.push(words[found].start);
      from = found + want.length;
    } else out.push(null);
  }
  // fill gaps
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) continue;
    const prev = i ? (out[i - 1] as number) : 0;
    let j = i + 1;
    while (j < out.length && out[j] == null) j++;
    const next = j < out.length ? (out[j] as number) : duration;
    out[i] = prev + (next - prev) / 2;
  }
  out[0] = 0;
  return out as number[];
}

/** The cue narrating at time t: the last one whose start is at or before t. */
export function cueAt(starts: readonly number[], t: number): number {
  let i = 0;
  for (let k = 1; k < starts.length; k++) if (starts[k] <= t) i = k;
  return i;
}

/** End of speech of cue i: the end of its last word before the next cue starts. */
export function speechEnds(starts: readonly number[], words: TimedWord[], duration: number): number[] {
  return starts.map((a, i) => {
    const next = i + 1 < starts.length ? starts[i + 1] : duration;
    let end = a + 0.1;
    for (const w of words) if (w.start >= a && w.end <= next + 1e-3) end = Math.max(end, w.end);
    return end;
  });
}

/* ── Captions ────────────────────────────────────────────────── */

/**
 * Words that open a new caption line (the owner's list plus a few of the
 * same kind). The line breaks before them, so a caption reads as a short
 * running phrase and never shows a whole sentence at once.
 */
export const BREAK_BEFORE = new Set([
  'to', 'and', 'but', 'in', 'you', 'that', 'from', 'so', 'with', 'then', 'or', 'if', 'when', 'before', 'after', 'for', 'on'
]);

/**
 * First word index of each caption line. A line always breaks after a full
 * stop, after a comma once it holds two words, before a word in
 * BREAK_BEFORE once it holds `min` words, and always at `max` words.
 */
export function lineStarts(words: readonly string[], max = 8, min = 3): number[] {
  const starts = [0];
  let len = 0;
  for (let k = 0; k < words.length - 1; k++) {
    len++;
    const stop = /[.;:!?]["')]?$/.test(words[k]);
    const comma = /,["')]?$/.test(words[k]);
    const nextBreaks = BREAK_BEFORE.has(norm(words[k + 1]));
    // Words left before the sentence ends: never leave one or two of them alone.
    let tail = 0;
    for (let j = k + 1; j < words.length; j++) {
      tail++;
      if (/[.;:!?]["')]?$/.test(words[j])) break;
      if (tail > 2) break;
    }
    const orphan = tail <= 2 && /[.;:!?]["')]?$/.test(words[k + tail] ?? '') && len + tail <= max + 2;
    if (stop || (!orphan && (len >= max || (comma && len >= 2) || (nextBreaks && len >= min)))) {
      starts.push(k + 1);
      len = 0;
    }
  }
  return starts;
}

/** Number of words whose start is at or before t (binary search). */
export function revealedCount(words: readonly TimedWord[], t: number): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The line (index into lines) that holds word k. */
export function lineOf(lines: readonly number[], k: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid] <= k) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/* ── Scroll that follows the voice ───────────────────────────── */

export function easeInOutSine(p: number): number {
  const c = p <= 0 ? 0 : p >= 1 ? 1 : p;
  return (1 - Math.cos(Math.PI * c)) / 2;
}

export interface Range {
  topY: number;
  endY: number;
}

/**
 * Scroll range of a section: from its top (less the sticky header offset)
 * to where its bottom meets the top of the player bar.
 */
export function sectionRange(top: number, height: number, viewport: number, reserve: number, maxScroll: number, offset: number): Range {
  const topY = Math.min(maxScroll, Math.max(0, Math.round(top - offset)));
  const visible = Math.max(1, viewport - reserve - offset);
  const endY = Math.min(maxScroll, Math.max(topY, Math.round(top + height - offset - visible)));
  return { topY, endY };
}

/** Page y at time t: inside the narrating cue's range, eased by its speech progress. */
export function followY(ranges: Range[], starts: number[], ends: number[], t: number): number {
  if (!ranges.length) return 0;
  const i = cueAt(starts, t);
  const a = starts[i];
  const b = Math.max(a + 0.1, ends[i]);
  const p = t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  return ranges[i].topY + (ranges[i].endY - ranges[i].topY) * easeInOutSine(p);
}

export const aboutMinutes = (seconds: number) => {
  const m = Math.max(1, Math.round(seconds / 60));
  return `about ${m === 1 ? 'one minute' : `${m} minutes`}`;
};
