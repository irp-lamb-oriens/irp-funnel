<script lang="ts">
  /** A payment status as word + icon + color, always together (never color alone). */
  import { PAY_STATUS, type PayStatus } from './paymentStatus.ts';
  export let status: PayStatus;
  /** Override the word (e.g. "Due when picked up") while keeping icon + color. */
  export let label: string | null = null;
  export let size: 'sm' | 'md' = 'md';
</script>

<span class="sp sp--{status} sp--{size}" title={PAY_STATUS[status].help}>
  <svg aria-hidden="true" viewBox="0 0 16 16" width={size === 'sm' ? 12 : 14} height={size === 'sm' ? 12 : 14} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    {#if status === 'received'}
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" /><path d="m5 8.2 2 2 4-4.2" stroke="#fff" />
    {:else if status === 'on_its_way'}
      <circle cx="8" cy="8" r="6.2" /><path d="M8 4.8V8l2.2 1.4" />
    {:else if status === 'problem'}
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" /><path d="M8 4.6v4.2" stroke="#fff" /><circle cx="8" cy="11.2" r=".6" fill="#fff" stroke="#fff" />
    {:else}
      <circle cx="8" cy="8" r="6.2" />
    {/if}
  </svg>
  <span>{label ?? PAY_STATUS[status].word}</span>
</span>

<style>
  .sp { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; border-radius: 999px; white-space: nowrap; line-height: 1.2; }
  .sp--md { font-size: 12.5px; padding: 3px 10px 3px 7px; }
  .sp--sm { font-size: 11px; padding: 2px 8px 2px 6px; }
  .sp--due { background: #f1f5f9; color: #475569; }
  .sp--on_its_way { background: #e0f2fe; color: #075985; }
  .sp--received { background: #dcfce7; color: #166534; }
  .sp--problem { background: #fef3f2; color: #b42318; }
  @media (forced-colors: active) { .sp { border: 1px solid CanvasText; } }
</style>
