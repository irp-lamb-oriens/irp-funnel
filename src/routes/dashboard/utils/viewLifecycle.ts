/**
 * viewLifecycle — hooks for views that stay mounted while hidden.
 *
 * The dashboard keeps a tab alive after its first visit (see +page.svelte), so
 * `onMount` runs once, not on every return. Views that need to react to being
 * shown again — re-sync their URL params, pick up a cross-link hand-off, or
 * quietly refresh stale data — register here instead.
 */
import { onDestroy } from 'svelte';
import { activeView } from '../store.ts';
import type { DashView } from '../access.ts';

/**
 * Run `cb` each time `view` becomes the active tab again (never on the initial
 * mount; use onMount for that). Must be called during component init.
 */
export function onViewShown(view: DashView, cb: () => void): void {
  let prev: string | null = null;
  const unsub = activeView.subscribe((v) => {
    const wasHidden = prev !== null && prev !== view;
    prev = v;
    if (v === view && wasHidden) queueMicrotask(cb);
  });
  onDestroy(unsub);
}

/**
 * When a tab is shown again and its data is older than this, it refreshes in
 * the background. The old figures stay on screen meanwhile (no skeleton).
 */
export const REVALIDATE_AFTER_MS = 60_000;
