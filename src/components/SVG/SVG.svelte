<script lang="ts">
  import { onMount } from 'svelte';
  export let src = ''; // URL to the SVG file

  let svgContent = ''; // Store fetched SVG content
  let error = ''; // Error message if fetching fails

  onMount(async () => {
    if (!src) {
      error = 'No source provided for the SVG.';
      return;
    }

    try {
      const localData = localStorage.getItem(`local-${src}`);

      if (localData) {
        svgContent = localData;
        return;
      }

      let liquidAssetURL = localStorage.getItem(src);

      if (liquidAssetURL?.startsWith("//")) {
        liquidAssetURL = `https:${liquidAssetURL}`;
      }

      console.log("liquidAssetURL", liquidAssetURL)

      const response = await fetch(liquidAssetURL || src);

      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
      }

      const data = await response.text();

      svgContent = data;

      localStorage.setItem(`local-${src}`, data);
    } catch (err) {
      error = (err as Error).message;
    }
  });
</script>
<span class="svg-request-source" data-request-source={src}></span>
{#if error}
  <p class="svg-loader--error">{error}</p>
{:else if svgContent}
  {@html svgContent}
{:else}
  <p class="svg-loader--loading"><span class="svg-loader--loading--dots"></span></p>
{/if}

<style lang="scss">
  @use './SVG.scss';
</style>
