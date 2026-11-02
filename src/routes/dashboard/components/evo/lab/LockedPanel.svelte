<script lang="ts">
  /** A locked analysis: what it needs, how far along it is. Never a noisy table. */
  export let title: string;
  export let need: string;
  export let have = 0;
  export let target = 1;
  $: share = Math.max(0, Math.min(1, target ? have / target : 0));
</script>

<div class="evo-locked">
  <span class="evo-locked__icon" aria-hidden="true">🔒</span>
  <div class="evo-locked__body">
    <p class="mh-strong">{title}</p>
    <p class="mh-hint">{need}</p>
    <div class="evo-locked__bar" role="progressbar" aria-valuemin="0" aria-valuemax={target} aria-valuenow={have} aria-label="{title} progress"><span style="width: {share * 100}%"></span></div>
    <p class="mh-muted">{have} of {target}</p>
  </div>
</div>
