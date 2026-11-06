<script lang="ts">
  import { reveal } from './reveal.ts';
  export let eyebrow = '';
  export let title: string;
  export let lead = '';
  export let id = '';
  export let center = false;
  export let dark = false;
</script>

<header class="head" class:center class:dark use:reveal>
  {#if eyebrow}<p class="eyebrow"><span class="dot" aria-hidden="true"></span>{eyebrow}</p>{/if}
  <h2 class="title" id={id || undefined}>{title}</h2>
  {#if lead}<p class="lead">{lead}</p>{/if}
  <slot />
</header>

<style lang="scss">
  @use './tokens' as *;

  .head {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    max-width: 760px;
    margin-bottom: $space-12;
    @include reveal;
  }
  .center { margin-inline: auto; text-align: center; align-items: center; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; }
  .lead { @include body; font-size: 1.125rem; max-width: 56ch; }
  .dark {
    .eyebrow, .title { color: $color-on-dark; }
    .lead { color: $color-on-dark-muted; }
  }
</style>
