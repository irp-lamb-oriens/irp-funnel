<script lang="ts">
  import type { ActivityMetric } from '../../store.ts';

  export let activity: ActivityMetric | undefined = undefined;

  type PeriodKey = 'weekly' | 'monthly' | 'annually' | 'allTime' | 'custom';
  let period: PeriodKey = 'monthly';
  let selectedClient = '';
  let customStart = '';
  let customEnd = '';
  let visibleCount = 20;

  const PERIODS: Array<{ key: PeriodKey; label: string }> = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'annually', label: 'Annually' },
    { key: 'allTime', label: 'All time' },
    { key: 'custom', label: 'Custom range' },
  ];

  const calls = activity?.calls;

  // Per-client call rows, optionally filtered to one client.
  $: perClient = (calls?.perClient ?? []).filter((c) =>
    !selectedClient || c.clientId === selectedClient,
  );

  // Date-derived buckets for the selected period.
  $: bucketed = (() => {
    if (period === 'allTime') {
      return { label: 'All time', entries: [['Total', calls?.total ?? 0] as [string, number]] };
    }
    if (period === 'custom') {
      const start = customStart ? new Date(customStart).getTime() : -Infinity;
      const end = customEnd ? new Date(customEnd).getTime() : Infinity;
      const count = perClient.reduce(
        (sum, c) => sum + c.dates.filter((d) => {
          const t = new Date(d).getTime();
          if (!Number.isFinite(t)) return false;
          if (Number.isFinite(start) && t < start) return false;
          if (Number.isFinite(end) && t > end) return false;
          return true;
        }).length,
        0,
      );
      return { label: 'Custom range', entries: [['Selected', count] as [string, number]] };
    }
    const source = period === 'weekly'
      ? calls?.weekly
      : period === 'annually'
        ? calls?.annually
        : calls?.monthly;
    const entries = Object.entries(source ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
    return { label: PERIODS.find((p) => p.key === period)?.label ?? '', entries };
  })();

  function maxBucket(entries: [string, number][]): number {
    return Math.max(1, ...entries.map(([, n]) => n || 0));
  }

  function clientTotal(c: { clientId: string; clientName: string; total: number; dates: string[] }): number {
    if (period !== 'custom') return c.total;
    const start = customStart ? new Date(customStart).getTime() : -Infinity;
    const end = customEnd ? new Date(customEnd).getTime() : Infinity;
    return c.dates.filter((d) => {
      const t = new Date(d).getTime();
      if (!Number.isFinite(t)) return false;
      if (Number.isFinite(start) && t < start) return false;
      if (Number.isFinite(end) && t > end) return false;
      return true;
    }).length;
  }

  $: shownClients = perClient.slice(0, visibleCount);
  function showMore() {
    visibleCount += 50;
  }
</script>

<div class="metric-module">
  <div class="metrics-section">
    <h2>📞 Calls</h2>

    <div class="segment-bar">
      <div class="period-tabs">
        {#each PERIODS as p}
          <button class:active={period === p.key} on:click={() => (period = p.key)}>{p.label}</button>
        {/each}
      </div>

      {#if period === 'custom'}
        <label for="calls-start">From</label>
        <input id="calls-start" type="date" bind:value={customStart} />
        <label for="calls-end">To</label>
        <input id="calls-end" type="date" bind:value={customEnd} />
      {/if}

      <label for="calls-client">Client</label>
      <select id="calls-client" bind:value={selectedClient}>
        <option value="">All clients</option>
        {#each (calls?.perClient ?? []) as c}
          <option value={c.clientId}>{c.clientName}</option>
        {/each}
      </select>
    </div>

    <div class="metrics-grid metrics-grid--small">
      <div class="metric-card" style="border-left: 4px solid #02b5bb">
        <div class="metric-card__value">{calls?.total ?? 0}</div>
        <div class="metric-card__label">All-time calls</div>
      </div>
      <div class="metric-card" style="border-left: 4px solid #3b82f6">
        <div class="metric-card__value">{perClient.length}</div>
        <div class="metric-card__label">Clients with calls</div>
      </div>
    </div>

    <div class="bucket-list">
      {#if bucketed.entries.length === 0}
        <p style="font-size: 12px; color: #94a3b8;">No calls in this period.</p>
      {:else}
        {#each bucketed.entries.slice(0, 24) as [key, count]}
          <div class="bucket-row">
            <span class="bucket-row__label" title={key}>{key}</span>
            <div class="bucket-row__track">
              <div class="bucket-row__fill" style="width: {(count / maxBucket(bucketed.entries) * 100).toFixed(1)}%"></div>
            </div>
            <span class="bucket-row__value">{count}</span>
          </div>
        {/each}
      {/if}
    </div>

    {#if perClient.length > 0}
      <div class="segment-controls">
        <h2 style="margin: 0;">By client</h2>
      </div>
      <div class="client-metric-table">
        <div class="breakdown-header">
          <span>Client</span><span>Calls</span><span></span><span></span>
        </div>
        {#each shownClients as c (c.clientId)}
          <div class="breakdown-row">
            <span class="breakdown-row__model" title={c.clientName}>{c.clientName}</span>
            <span>{clientTotal(c)}</span>
            <span></span>
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