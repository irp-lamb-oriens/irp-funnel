<script lang="ts">
  /**
   * GroupHeader — the one header every group of components uses.
   *
   *   <section class="irp-group">
   *     <GroupHeader
   *       title="Won revenue by month"
   *       description="Accepted quotes, by the month the client accepted them."
   *       info="Margin is revenue minus provider cost."
   *       status={{ state: 'loading' }}
   *     >
   *       <svelte:fragment slot="actions"><button class="irp-btn irp-btn--sm">Export</button></svelte:fragment>
   *     </GroupHeader>
   *     …group content…
   *   </section>
   *
   * Reads top-down as: what is this (title) → why it matters / how to read it
   * (description, ⓘ for the detail) → what it's doing now (status) → what I can
   * do (actions). `description` is required by styles.guard.test.ts: a group
   * without a sentence of context is the thing this component exists to stop.
   */
  import InfoTip from './InfoTip.svelte';
  import StatusLine from './StatusLine.svelte';

  export let title: string;
  export let description = '';
  /** Small uppercase label above the title (e.g. a step or category). */
  export let eyebrow = '';
  /** Longer explanation, behind an ⓘ next to the title. */
  export let info = '';
  export let level: 2 | 3 | 4 = 3;
  export let id = `irp-g-${Math.random().toString(36).slice(2, 9)}`;
  export let status: { state: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'stale'; message?: string } | null = null;
  export let compact = false;
</script>

<header class="irp-group__head" class:irp-group__head--compact={compact}>
  <div class="irp-group__titles">
    {#if eyebrow}<span class="irp-overline">{eyebrow}</span>{/if}
    <svelte:element this={`h${level}`} {id} class="irp-group__title">
      {title}{#if info}<InfoTip text={info} label={`About ${title}`} />{/if}
    </svelte:element>
    {#if description || $$slots.description}
      <p class="irp-group__desc"><slot name="description">{description}</slot></p>
    {/if}
  </div>
  {#if (status && status.state !== 'idle') || $$slots.actions}
    <div class="irp-group__aside">
      {#if status}<StatusLine state={status.state} message={status.message ?? ''} />{/if}
      <slot name="actions" />
    </div>
  {/if}
</header>
