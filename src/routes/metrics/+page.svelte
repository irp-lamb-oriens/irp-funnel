<script lang="ts">
  import { onMount } from 'svelte';
  import { metricsData } from './store.ts';
  import store from '../../components/store.ts';
  import { get } from 'svelte/store';
  import Overview from './Overview.svelte';
  import UserList from './UserList.svelte';
  import Comparisons from './Comparisons.svelte';
  import ABTesting from './ABTesting.svelte';
  import VideoPerformance from './VideoPerformance.svelte';
  import './styles.scss';

  let activeTab = 'Overview';

  onMount(async () => {
    const storeValue = get(store);
    const apiUrl = storeValue.apiURL();
    console.log(`Fetching metrics from: ${apiUrl}/api/metrics`);
    try {
      const response = await fetch(`${apiUrl}/api/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received metrics data:', data);
      metricsData.set(data);
    } catch (error) {
      console.error('Error fetching metrics data:', error);
    }
  });
</script>

<div class="metrics-dashboard">
  <div class="metrics-dashboard__tabs">
    <button class="metrics-dashboard__tab" class:active={activeTab === 'Overview'} on:click={() => activeTab = 'Overview'}>Overview</button>
    <button class="metrics-dashboard__tab" class:active={activeTab === 'UserList'} on:click={() => activeTab = 'UserList'}>User List</button>
    <button class="metrics-dashboard__tab" class:active={activeTab === 'Comparisons'} on:click={() => activeTab = 'Comparisons'}>Comparisons</button>
    <button class="metrics-dashboard__tab" class:active={activeTab === 'ABTesting'} on:click={() => activeTab = 'ABTesting'}>A/B Testing</button>
    <button class="metrics-dashboard__tab" class:active={activeTab === 'VideoPerformance'} on:click={() => activeTab = 'VideoPerformance'}>Video Performance</button>
  </div>

  <div class="metrics-dashboard__content">
  {#if $metricsData}
    {#if activeTab === 'Overview'}
      <Overview />
    {:else if activeTab === 'UserList'}
      <UserList />
    {:else if activeTab === 'Comparisons'}
      <Comparisons />
    {:else if activeTab === 'ABTesting'}
      <ABTesting />
    {:else if activeTab === 'VideoPerformance'}
      <VideoPerformance />
    {/if}
  {:else}
    <p class="metrics-dashboard__loading">Loading...</p>
  {/if}
  </div>
</div>
