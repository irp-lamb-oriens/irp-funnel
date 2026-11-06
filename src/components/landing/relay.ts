/**
 * The journey line under How it works. One long one-colour landscape (about
 * three screens wide) that the page pans across from the first step to the
 * end of the last: an old house, the loading depot, the port of departure,
 * open sea, customs at the port of arrival, the new home. A single traveller
 * moves along the line and changes form with the stage: a box on a hand
 * truck, a moving truck, a container ship, a container truck, and the box at
 * the new front door.
 *
 * Pure functions of scroll progress (no clock), so scrubbing is exact.
 */
import { clamp, easeInOut, lerp } from './scene.ts';

/** World width in line units; the viewBox is 100 units tall. */
export const WORLD_W = 4000;
export const LINE_Y = 70;

export interface Station {
  x: number;
  label: string;
}
export const STATIONS: Station[] = [
  { x: 300, label: 'Packing' },
  { x: 900, label: 'Loading' },
  { x: 1500, label: 'Port of departure' },
  { x: 2150, label: 'At sea' },
  { x: 2800, label: 'Customs' },
  { x: 3600, label: 'Delivery' }
];

/** Ocean stretch of the line (between the two ports). */
export const SEA_FROM = 1580;
export const SEA_TO = 2720;

/**
 * Keyframes: [progress, x]. Equal x on consecutive keys is a hold, so the
 * traveller pauses at each stop long enough to read it.
 */
const KEYS: [number, number][] = [
  [0, 300],
  [0.05, 300],
  [0.2, 900],
  [0.24, 900],
  [0.37, 1500],
  [0.41, 1500],
  [0.72, 2800],
  [0.78, 2800],
  [0.95, 3600],
  [1, 3600]
];

export function travellerX(r: number): number {
  const t = clamp(r);
  for (let i = 1; i < KEYS.length; i++) {
    const [p1, x1] = KEYS[i];
    const [p0, x0] = KEYS[i - 1];
    if (t <= p1) return x0 === x1 ? x0 : lerp(x0, x1, easeInOut((t - p0) / (p1 - p0)));
  }
  return KEYS[KEYS.length - 1][1];
}

export type Form = 'dolly' | 'truck' | 'ship' | 'rig' | 'box';
/** Where each form takes over (x), in order. */
const FORMS: [number, Form][] = [
  [0, 'dolly'],
  [900, 'truck'],
  [1580, 'ship'],
  [2790, 'rig'],
  [3560, 'box']
];
const FADE = 36;

/** Opacity of each traveller form at x (cross-fades at each hand-over). */
export function formWeights(x: number): Record<Form, number> {
  const w: Record<Form, number> = { dolly: 0, truck: 0, ship: 0, rig: 0, box: 0 };
  for (let i = 0; i < FORMS.length; i++) {
    const start = FORMS[i][0];
    const end = i + 1 < FORMS.length ? FORMS[i + 1][0] : Infinity;
    const fin = i === 0 ? 1 : clamp((x - (start - FADE)) / FADE);
    const fout = end === Infinity ? 1 : clamp(1 - (x - (end - FADE)) / FADE);
    w[FORMS[i][1]] = Math.min(fin, fout);
  }
  return w;
}

/** Index of the last station reached. */
export function reachedStation(x: number): number {
  let k = 0;
  STATIONS.forEach((s, i) => {
    if (x >= s.x - 2) k = i;
  });
  return k;
}

/** Camera left edge for a view `viewW` wide: follows the traveller, clamped to the world. */
export function cameraX(x: number, viewW: number): number {
  return clamp(x - viewW * 0.42, 0, Math.max(0, WORLD_W - viewW));
}

/** The customs barrier lifts as the traveller arrives and drops after it leaves. */
export function barrierLift(x: number): number {
  const gate = STATIONS[4].x + 40;
  const d = x - gate;
  if (d < -150) return 0;
  if (d < -40) return easeInOut((d + 150) / 110);
  if (d < 60) return 1;
  if (d < 160) return 1 - easeInOut((d - 60) / 100);
  return 0;
}
