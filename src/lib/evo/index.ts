/**
 * Evo — public entrypoint.
 * Re-exports the surface most consumers need.
 */

export { EVO_COMPONENTS, getComponentConfig } from './config.ts';
// Note: the type exported from config.ts is re-exported under a distinct
// name so it does NOT collide with the `EvoVariant` Svelte component below.
export type { EvoVariant as EvoVariantConfig, EvoComponentConfig } from './config.ts';

export {
  useVariant,
  getVariants,
  trackExposure,
  trackInteraction,
  identify,
  getEvoContext,
} from './client.ts';
export type { EvoEventPayload, EvoEventType } from './client.ts';

export {
  getVisitorId,
  getCommitHash,
  getCommitMessage,
  getKnownEmail,
} from './identity.ts';

export { default as EvoVariant } from './EvoVariant.svelte';
