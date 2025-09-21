<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { metricsData } from './store.ts';
  import { Chart, registerables } from 'chart.js';
  Chart.register(...registerables);

  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function createOrUpdateChart() {
    if (!$metricsData || !$metricsData.videoPerformance || !chartCanvas) {
      return;
    }

    if (chart) {
      chart.destroy();
    }

    const sortedData = Object.entries($metricsData.videoPerformance)
      .map(([key, value]) => ({ x: Number(key), y: value }))
      .sort((a, b) => a.x - b.x);

    console.log('Chart data:', sortedData);

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Video Drop-off',
          data: sortedData,
          fill: true,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          pointRadius: 10,
          pointBackgroundColor: 'red'
        }]
      },
      options: {
        scales: {
          y: {
            title: {
              display: true,
              text: 'Number of Users'
            }
          },
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Video Duration (seconds)'
            },
            max: 600,
            min: 0
          }
        }
      }
    });
  }

  onMount(() => {
    createOrUpdateChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  $: if ($metricsData && chartCanvas) {
    createOrUpdateChart();
  }
</script>

<div class="video-performance">
  <h2 class="video-performance__title">Video Performance</h2>

  {#if $metricsData && $metricsData.videoPerformance}
    <div class="video-performance__chart-container">
      <canvas bind:this={chartCanvas}></canvas>
    </div>
  {:else if $metricsData}
    <p class="video-performance__no-data">No video performance data available.</p>
  {/if}
</div>
