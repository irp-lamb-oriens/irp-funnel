<!--
  AnimatedNumber — counts smoothly to `value` (tabular figures, so the width
  never jumps). Instant when the visitor asked for reduced motion.
-->
<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { reducedMotion } from '../../utils/motion.ts';

  export let value = 0;
  export let duration = 700;

  const shown = tweened(value, { duration, easing: cubicOut });
  $: shown.set(value, { duration: $reducedMotion ? 0 : duration });
</script>

<span class="anum">{Math.round($shown).toLocaleString('en-US')}</span>

<style>
  .anum { font-variant-numeric: tabular-nums; }
</style>
