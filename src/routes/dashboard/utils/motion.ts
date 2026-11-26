/**
 * motion.ts — one switch for the dashboard's animations. People who ask their
 * system for reduced motion get every duration and delay as 0.
 */
import { readable } from 'svelte/store';

export const reducedMotion = readable(false, (set) => {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const q = window.matchMedia('(prefers-reduced-motion: reduce)');
  set(q.matches);
  const on = () => set(q.matches);
  q.addEventListener('change', on);
  return () => q.removeEventListener('change', on);
});

/** `ms`, or 0 when motion is reduced. */
export function motionMs(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms;
}

/** Cascade delay for the i-th item of a batch, capped so long lists never wait. */
export function cascade(i: number, reduced: boolean, step = 45, max = 9): number {
  return reduced ? 0 : Math.min(i, max) * step;
}
