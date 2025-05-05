<!-- src/components/systems/stats/Stat.svelte -->
<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { Chart, registerables } from "chart.js/auto";
  import type { ChartConfiguration, ChartData } from "chart.js/auto";

  // Define a type for the expected data item structure
  type StatDataItem = {
    name?: string; // Optional name
    id?: string; // Optional id (fallback)
    total: number; // Required total value
    [key: string]: any; // Allow other properties if needed
  };

  // --- Props ---
  /** Callback function that returns the array of data items */
  export let dataCallback: () => StatDataItem[];
  /** HEX color for the chart bars/lines */
  export let HEXColor: string = "#03a9f4"; // Default color
  /** Label for the X-axis */
  export let xText: string = "Category";
  /** Label for the Y-axis and dataset */
  export let yText: string = "Total";

  // --- Reactive Variables ---
  let chartInstance: Chart | null = null;
  let canvasElement: HTMLCanvasElement;
  let currentChartData: ChartData | null = null; // Store formatted data

  // Register all Chart.js components (only needs to happen once)
  Chart.register(...registerables);

  // --- Helper Functions ---

  function formatChartData(
    rawData: StatDataItem[] | undefined | null
  ): ChartData {
    if (!rawData || rawData.length === 0) {
      console.warn("Stat.svelte: No data provided or empty array.");
      return { labels: [], datasets: [] };
    }

    const labels = rawData.map(
      (item) => item.name || item.id || `Item ${index + 1}` || "Unknown"
    ); // Improved fallback label
    const dataValues = rawData.map((item) => item.total || 0); // Default to 0 if total is missing/falsy

    return {
      labels,
      datasets: [
        {
          label: yText, // Use prop for dataset label
          data: dataValues,
          borderColor: HEXColor,
          backgroundColor: `${HEXColor}44`, // Use alpha for background
          borderWidth: 1,
        },
      ],
    };
  }

  function getChartOptions(): ChartConfiguration["options"] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true, // Keep legend for the dataset label
          labels: {
            // Add theme-aware color options if needed later
          },
        },
        tooltip: {
          // Add custom tooltips if desired
        },
      },
      scales: {
        x: {
          type: "category",
          title: {
            display: !!xText, // Only display if text is provided
            text: xText,
            // Add theme-aware color options if needed later
          },
          ticks: {
            // Add theme-aware color options if needed later
          },
        },
        y: {
          title: {
            display: !!yText, // Only display if text is provided
            text: yText,
            // Add theme-aware color options if needed later
          },
          beginAtZero: true,
          ticks: {
            // Add theme-aware color options if needed later
          },
        },
      },
    };
  }

  // --- Lifecycle ---
  onMount(() => {
    if (!canvasElement) {
      console.error("Stat.svelte: Canvas element not found on mount.");
      return;
    }
    const ctx = canvasElement.getContext("2d");
    if (!ctx) {
      console.error("Stat.svelte: Failed to get 2D context from canvas.");
      return;
    }

    // Initial data processing
    currentChartData = formatChartData(dataCallback ? dataCallback() : []);

    // Create the chart initially
    chartInstance = new Chart(ctx, {
      type: "bar", // Default to bar, could be a prop
      data: currentChartData,
      options: getChartOptions(),
    });

    // Cleanup function
    return () => {
      if (chartInstance) {
        console.log("Stat.svelte: Destroying chart instance.");
        chartInstance.destroy();
        chartInstance = null;
      }
    };
  });

  // --- Reactivity for Updates ---

  // Re-format data when the callback result changes
  $: if (dataCallback && typeof dataCallback === "function") {
    const newData = dataCallback();
    // Check if data actually changed before updating (simple JSON compare)
    // This prevents unnecessary updates if the callback returns the same data object/array
    if (
      JSON.stringify(newData) !==
      JSON.stringify(currentChartData ? formatChartData(newData) : null)
    ) {
      console.log("Stat.svelte: Data changed, formatting and updating chart.");
      currentChartData = formatChartData(newData);
      if (chartInstance && currentChartData) {
        chartInstance.data = currentChartData;
        // Optionally update options if they depend on data, then call update
        // chartInstance.options = getChartOptions(); // Usually not needed unless scales change drastically
        chartInstance.update();
      }
    }
  } else {
    // Handle case where dataCallback becomes null/undefined
    currentChartData = formatChartData([]);
    if (chartInstance && currentChartData) {
      chartInstance.data = currentChartData;
      chartInstance.update();
    }
  }

  // Update chart options when relevant props change
  $: if (chartInstance && (HEXColor || xText || yText)) {
    console.log("Stat.svelte: Props changed, updating chart options.");
    // Update dataset colors directly
    if (chartInstance.data.datasets[0]) {
      chartInstance.data.datasets[0].borderColor = HEXColor;
      chartInstance.data.datasets[0].backgroundColor = `${HEXColor}44`;
      chartInstance.data.datasets[0].label = yText; // Update dataset label
    }
    // Update scales
    if (chartInstance.options?.scales?.x?.title) {
      chartInstance.options.scales.x.title.text = xText;
      chartInstance.options.scales.x.title.display = !!xText;
    }
    if (chartInstance.options?.scales?.y?.title) {
      chartInstance.options.scales.y.title.text = yText;
      chartInstance.options.scales.y.title.display = !!yText;
    }
    // Trigger chart update to reflect option changes
    chartInstance.update();
  }
</script>

<div class="chart-container">
  <canvas bind:this={canvasElement}></canvas>
</div>

<style>
  .chart-container {
    width: 100%;
    height: 300px; /* Adjusted default height */
    position: relative; /* Keep for potential absolute elements inside */
    padding: 10px; /* Add some padding */
    background-color: var(
      --color-background-very-opaque,
      rgba(255, 255, 255, 0.05)
    ); /* Subtle background */
    border: 1px solid
      var(--color-background-input-border, rgba(255, 255, 255, 0.1)); /* Subtle border */
    border-radius: 8px; /* Rounded corners */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  canvas {
    display: block; /* Prevent extra space below canvas */
    width: 100%;
    height: 100%;
  }
</style>
