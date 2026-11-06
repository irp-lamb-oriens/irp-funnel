/**
 * Scroll scenes for the IRP home.
 *
 * A scene is a tall section (`--len` screens) with a sticky full-screen
 * stage inside. `use:scene={cb}` reports the scene's progress, 0 when its
 * top reaches the top of the screen and 1 when its bottom reaches the
 * bottom, smoothed toward the real scroll position each frame (a light
 * scrub, so wheel steps glide). One requestAnimationFrame loop serves every
 * scene and only runs while the page scrolls or a scene is still settling.
 *
 * Because the scene's height is real document height, the narrator's
 * scroll-follow (components/narration) moves through each scene in step
 * with the voice without knowing about it.
 *
 * Reduced motion: progress is always 1 and the scene element gets the
 * `rm` class; each scene's CSS lays every item out statically under `.rm`
 * (no sticky stage, nothing hidden).
 */

type Callback = (p: number) => void;

interface Entry {
  node: HTMLElement;
  cb: Callback;
  target: number;
  value: number;
  near: boolean;
}

const entries = new Set<Entry>();
let raf = 0;
let listening = false;
let reduce = false;
const SMOOTH = 0.16;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
/** Local progress of p inside [a, b]. */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function measure(e: Entry) {
  const r = e.node.getBoundingClientRect();
  const vh = window.innerHeight;
  e.near = r.bottom > -vh && r.top < vh * 2;
  const run = r.height - vh;
  e.target = run > 0 ? clamp(-r.top / run) : r.top <= 0 ? 1 : 0;
}

function frame() {
  raf = 0;
  let moving = false;
  for (const e of entries) {
    measure(e);
    if (!e.near && Math.abs(e.value - e.target) < 0.0005) continue;
    const d = e.target - e.value;
    // Far jumps (narrator teleports, anchor links) land at once.
    const next = Math.abs(d) > 0.35 || Math.abs(d) < 0.0005 ? e.target : e.value + d * SMOOTH;
    if (next !== e.value) {
      e.value = next;
      e.cb(next);
    }
    if (Math.abs(e.target - e.value) >= 0.0005) moving = true;
  }
  if (moving) raf = requestAnimationFrame(frame);
}

const kick = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};

function listen() {
  if (listening) return;
  listening = true;
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scene(node: HTMLElement, cb: Callback) {
  listen();
  if (reduce) {
    node.classList.add('rm');
    cb(1);
    return {};
  }
  const e: Entry = { node, cb, target: 0, value: -1, near: true };
  measure(e);
  e.value = e.target;
  cb(e.value);
  entries.add(e);
  kick();
  return {
    update(next: Callback) {
      e.cb = next;
    },
    destroy() {
      entries.delete(e);
    }
  };
}

/**
 * A scene that visits `n` stations in turn: it holds on each (the station's
 * own animation plays during the hold) and moves to the next between holds.
 * Returns `x` (0..n-1, fractional while moving), the station being held or
 * last left (`at`), and `local(i)`: 0 before station i is reached, its hold
 * progress while held, 1 once left.
 */
export function stations(p: number, n: number, hold = 1, move = 0.9, pad = 0.03) {
  const total = n * hold + (n - 1) * move;
  let u = seg(p, pad, 1 - pad) * total;
  let x = 0;
  let at = 0;
  let h = 0;
  for (let i = 0; i < n; i++) {
    if (u <= hold) {
      at = i;
      x = i;
      h = u / hold;
      break;
    }
    u -= hold;
    if (i === n - 1) {
      at = i;
      x = i;
      h = 1;
      break;
    }
    if (u <= move) {
      at = i;
      x = i + easeInOut(u / move);
      h = 1;
      break;
    }
    u -= move;
  }
  const local = (i: number) => (i < at || (i === at && x > at) ? 1 : i === at ? h : 0);
  return { x, at, hold: h, local };
}
