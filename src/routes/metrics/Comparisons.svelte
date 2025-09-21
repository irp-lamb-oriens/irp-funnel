<script lang="ts">
  import { metricsData } from './store.ts';
</script>

<div class="comparisons">
  <h2 class="comparisons__title">Comparisons</h2>

  <table class="comparisons__table">
    <thead>
      <tr>
        <th>Email</th>
        <th>Thank You Src</th>
        <th>Influencer</th>
        <th>UTM ID</th>
        <th>Funnel Copy</th>
        <th>Funnel Version</th>
      </tr>
    </thead>
    <tbody>
      {#if $metricsData && $metricsData.users}
        {#each $metricsData.users as user}
          <tr>
            <td data-label="Email">{user.email || 'N/A'}</td>
            <td data-label="Thank You Src">{user.submit?.funnelObject?.thankYouSrc || 'N/A'}</td>
            <td data-label="Influencer">{user.utm?.influencer || 'N/A'}</td>
            <td data-label="UTM ID">{user.utm?.id || 'N/A'}</td>
            <td data-label="Funnel Copy">{user.submit?.funnelObject?.copy || 'N/A'}</td>
            <td data-label="Funnel Version">{user.submit?.funnelVersion || 'N/A'}</td>
          </tr>
        {/each}
      {:else}
        <tr>
          <td colspan="6" class="comparisons__no-results">No data available.</td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
