import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * Dev-only preview of the Evo Lab with seeded synthetic data (no login, no
 * real data). Used for design review and Playwright. 404 in production.
 */
export const ssr = false;
export function load() {
  if (!dev) throw error(404, 'Not found');
  return {};
}
