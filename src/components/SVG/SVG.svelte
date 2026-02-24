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
  <div class="ultra-modern-loader mini">
    <div class="magnetic-orb">
      <div class="inner-core"></div>
      <div class="pulse-ring"></div>
    </div>
    <div class="neon-trail"></div>
  </div>
{/if}

<style lang="scss">
  @use './SVG.scss';

  .ultra-modern-loader.mini {
    display: inline-flex;
    position: relative;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin: 10px;

    .magnetic-orb {
      position: relative;
      width: 6px;
      height: 6px;
      background: #ffffff;
      border-radius: 50%;
      z-index: 2;
      
      .inner-core {
        position: absolute;
        inset: 1px;
        background: var(--color-highlight-2);
        border-radius: 50%;
        animation: corePulse 0.8s ease-in-out infinite alternate;
      }

      .pulse-ring {
        position: absolute;
        inset: -6px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        animation: ringPulse 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite;
      }
    }

    .neon-trail {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid transparent;
      border-top: 1.5px solid #ffffff;
      animation: ultraSpin 0.6s linear infinite;
    }
  }

  @keyframes ultraSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes corePulse {
    from { transform: scale(0.8); opacity: 0.5; }
    to { transform: scale(1.1); opacity: 1; }
  }

  @keyframes ringPulse {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }
</style>
