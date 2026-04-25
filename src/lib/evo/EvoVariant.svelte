<!--
  EvoVariant.svelte
  ────────────────────────────────────────────────────────────────────────────
  Declarative wrapper around `useVariant` + `trackExposure`. Consumers who
  wrap a variant-aware block with this component get automatic, once-per-mount
  exposure logging and a `variant` slot prop for conditional rendering.

  Usage:
    <EvoVariant component="HeroForm" let:variant>
      {#if variant === 'v2-warm-copy'}
        …warm copy…
      {:else if variant === 'v3-urgent-copy'}
        …urgent copy…
      {:else}
        …baseline copy…
      {/if}
    </EvoVariant>
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useVariant, trackExposure } from './client.ts';

  /** Registered component key (see evo/config.ts). */
  export let component: string;
  /** Optional metadata captured alongside the exposure event. */
  export let meta: Record<string, unknown> | undefined = undefined;

  const variant: string = useVariant(component);

  onMount(() => {
    trackExposure(component, variant, meta);
  });
</script>

<slot {variant} />
