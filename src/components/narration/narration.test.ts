import { describe, expect, it } from 'vitest';
import { formatTime, nextRate, spokenTime, transcriptSections, type Cue, type TimedWord } from './narration.ts';

describe('narrator player helpers', () => {
  it('formats clock time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });

  it('spells time for screen readers', () => {
    expect(spokenTime(1)).toBe('1 second');
    expect(spokenTime(45)).toBe('45 seconds');
    expect(spokenTime(60)).toBe('1 minute');
    expect(spokenTime(125)).toBe('2 minutes 5 seconds');
  });

  it('cycles playback speed and recovers from unknown values', () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(0.75)).toBe(1);
    expect(nextRate(2)).toBe(1);
  });

  it('splits the transcript by cue start', () => {
    const words: TimedWord[] = ['Hi,', 'I am', 'Pablo.', 'The', 'rules.'].map((w, i) => ({ word: w, start: i, end: i + 0.9 }));
    const cues = [
      { id: 'a', anchor: 'a', label: 'A', match: '' },
      { id: 'b', anchor: 'b', label: 'B', match: '' }
    ] as Cue[];
    const s = transcriptSections(cues, words, [0, 3]);
    expect(s.map((x) => [x.first, x.last])).toEqual([[0, 3], [3, 5]]);
    expect(s[1].label).toBe('B');
  });
});
