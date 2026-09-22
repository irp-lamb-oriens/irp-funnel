<script lang="ts">
  import type { ActivityMetric } from '../../store.ts';

  export let activity: ActivityMetric | undefined = undefined;

  let selectedClient = '';
  let visibleCount = 20;

  const quotes = activity?.quotes;

  $: perClient = (quotes?.perClient ?? []).filter((c) =>
    !selectedClient || c.clientId === selectedClient,
  );

  $: shownClients = perClient.slice(0, visibleCount);
  function showMore() {
    visibleCount += 50;
  }
</script>

<div class="metric-module">
  <div class="metrics-section">
    <h2>📄 Quotes</h2>

    <div class="segment-bar">
      <label for="quotes-client">Client</label>
      <select id="quotes-client" bind:value={selectedClient}>
        <option value="">All clients</option>
        {#each (quotes?.perClient ?? []) as c}
          <option value={c.clientId}>{c.clientName}</option>
        {/each}
      </select>
    </div>

    <div class="metrics-grid metrics-grid--small">
      <div class="metric-card" style="border-left: 4px solid #8b5cf6">
        <div class="metric-card__value">{quotes?.total ?? 0}</div>
        <div class="metric-card__label">Generated</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid #16a34a">
        <div class="metric-card__value">{quotes?.accepted ?? 0}</div>
        <div class="metric-card__label">Accepted</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid #94a3b8">
        <div class="metric-card__value">{quotes?.total ?? 0}</div>
        <div class="metric-card__label">Created</div>
      </div>
    </div>

    {#if perClient.length > 0}
      <div class="segment-controls">
        <h2 style="margin: 0;">By client</h2>
      </div>
      <div class="client-metric-table">
        <div class="breakdown-header">
          <span>Client</span><span>Generated</span><span>Accepted</span><span></span>
        </div>
        {#each shownClients as c (c.clientId)}
          <div class="breakdown-row">
            <span class="breakdown-row__model" title={c.clientName}>{c.clientName}</span>
            <span>{c.total}</span>
            <span>{c.accepted}</span>
            <span></span>
          </div>
        {/each}
        {#if perClient.length > visibleCount}
          <div style="padding: 8px 16px;">
            <button class="show-more" on:click={showMore}>
              Show {Math.min(50, perClient.length - visibleCount)} more of {perClient.length - visibleCount} remaining
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>