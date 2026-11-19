<script lang="ts">
  /**
   * EmptyState — says what is missing AND what to do about it.
   *
   *   <EmptyState title="No invoices yet" body="Invoices appear here once a quote is accepted.">
   *     <button slot="action" class="irp-btn irp-btn--primary" on:click={create}>New invoice</button>
   *   </EmptyState>
   */
  export let title: string;
  export let body = '';
  export let icon = '';
  export let compact = false;
</script>

<div class="irp-empty irp-empty--rich" class:irp-empty--compact={compact} role="status">
  {#if icon}<span class="irp-empty__icon" aria-hidden="true">{icon}</span>{/if}
  <p class="irp-empty__title">{title}</p>
  {#if body || $$slots.default}<p class="irp-empty__body"><slot>{body}</slot></p>{/if}
  {#if $$slots.action}<div class="irp-empty__action"><slot name="action" /></div>{/if}
</div>
