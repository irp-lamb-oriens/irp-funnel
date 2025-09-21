<script lang="ts">
  import { metricsData } from './store.ts';
</script>

<div class="ab-testing">
  <h2 class="ab-testing__title">A/B Testing</h2>

  {#if $metricsData && $metricsData.abTesting}
    <div class="ab-testing__grid">
      {#if $metricsData.abTesting.copy}
        <div class="ab-testing__card">
          <h3 class="ab-testing__card-title">Copy</h3>
          <table class="ab-testing__table">
            <thead>
              <tr>
                <th>Copy</th>
                <th>Users</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries($metricsData.abTesting.copy) as [copy, data]}
                <tr>
                  <td data-label="Copy">{copy}</td>
                  <td data-label="Users">{data.users}</td>
                  <td data-label="Conversion Rate">{data.conversionRate}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if $metricsData.abTesting.videoSrc}
        <div class="ab-testing__card">
          <h3 class="ab-testing__card-title">Video Src</h3>
          <table class="ab-testing__table">
            <thead>
              <tr>
                <th>Video Src</th>
                <th>Users</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries($metricsData.abTesting.videoSrc) as [src, data]}
                <tr>
                  <td data-label="Video Src">{src}</td>
                  <td data-label="Users">{data.users}</td>
                  <td data-label="Conversion Rate">{data.conversionRate}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if $metricsData.abTesting.funnelId}
        <div class="ab-testing__card">
          <h3 class="ab-testing__card-title">Funnel ID</h3>
          <table class="ab-testing__table">
            <thead>
              <tr>
                <th>Funnel ID</th>
                <th>Users</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries($metricsData.abTesting.funnelId) as [id, data]}
                <tr>
                  <td data-label="Funnel ID">{id}</td>
                  <td data-label="Users">{data.users}</td>
                  <td data-label="Conversion Rate">{data.conversionRate}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if $metricsData.abTesting.influencer}
        <div class="ab-testing__card">
          <h3 class="ab-testing__card-title">Influencer</h3>
          <table class="ab-testing__table">
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Users</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries($metricsData.abTesting.influencer) as [influencer, data]}
                <tr>
                  <td data-label="Influencer">{influencer}</td>
                  <td data-label="Users">{data.users}</td>
                  <td data-label="Conversion Rate">{data.conversionRate}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if $metricsData.abTesting.utmVideo}
        <div class="ab-testing__card">
          <h3 class="ab-testing__card-title">UTM Video</h3>
          <table class="ab-testing__table">
            <thead>
              <tr>
                <th>UTM Video</th>
                <th>Users</th>
                <th>Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each Object.entries($metricsData.abTesting.utmVideo) as [video, data]}
                <tr>
                  <td data-label="UTM Video">{video}</td>
                  <td data-label="Users">{data.users}</td>
                  <td data-label="Conversion Rate">{data.conversionRate}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <p class="ab-testing__no-data">No A/B testing data available.</p>
  {/if}
</div>
