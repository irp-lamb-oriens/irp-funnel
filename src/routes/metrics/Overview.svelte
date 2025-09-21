<script lang="ts">
  import { metricsData } from './store.ts';
</script>

{#if $metricsData}
<div class="overview">
  <h2 class="overview__title">Overview</h2>

  <div class="overview__summary">
    <div class="overview__metric">
      <span class="overview__metric-label">Total Users</span>
      <span class="overview__metric-value">{$metricsData.totalUsers || 0}</span>
    </div>
    <div class="overview__metric">
      <span class="overview__metric-label">Average Budget</span>
      <span class="overview__metric-value">{$metricsData.averageBudget || 0}</span>
    </div>
  </div>

  <div class="overview__details">
    {#if $metricsData.usersByCountry}
      <div class="overview__chart">
        <h3 class="overview__chart-title">Users by Country</h3>
        <ul class="overview__chart-list">
          {#each Object.entries($metricsData.usersByCountry) as [country, count]}
            <li class="overview__chart-item">
              <span class="overview__chart-label">{country}</span>
              <span class="overview__chart-value">{count}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if $metricsData.reasonsForMoving}
      <div class="overview__chart">
        <h3 class="overview__chart-title">Reasons for Moving</h3>
        <ul class="overview__chart-list">
          {#each Object.entries($metricsData.reasonsForMoving) as [reason, count]}
            <li class="overview__chart-item">
              <span class="overview__chart-label">{reason}</span>
              <span class="overview__chart-value">{count}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if $metricsData.propertyTypes}
      <div class="overview__chart">
        <h3 class="overview__chart-title">Property Types (From)</h3>
        {#if $metricsData.propertyTypes.from}
          <ul class="overview__chart-list">
            {#each Object.entries($metricsData.propertyTypes.from) as [type, count]}
              <li class="overview__chart-item">
                <span class="overview__chart-label">{type}</span>
                <span class="overview__chart-value">{count}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="overview__chart">
        <h3 class="overview__chart-title">Property Types (To)</h3>
        {#if $metricsData.propertyTypes.to}
          <ul class="overview__chart-list">
            {#each Object.entries($metricsData.propertyTypes.to) as [type, count]}
              <li class="overview__chart-item">
                <span class="overview__chart-label">{type}</span>
                <span class="overview__chart-value">{count}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}
