<script lang="ts">
  /** One always-visible line: tracking healthy, or the most severe problem. */
  import type { LabHealthLine } from '../engine/lab.ts';
  export let line: LabHealthLine;
  export let onOpen: () => void;
</script>

<div class="evo-health evo-health--{line.tone}" role="status">
  <span class="evo-health__dot" aria-hidden="true"></span>
  <span class="evo-health__text"><b>{line.tone === 'good' ? 'Healthy' : line.tone === 'watch' ? 'Check' : 'Problem'}:</b> {line.text}</span>
  <button class="mh-link" on:click={onOpen}>Data health →</button>
</div>
