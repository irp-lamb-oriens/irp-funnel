<!-- irp-funnel/src/components/Video/Loading.svelte -->
<div class="loading-spinner" aria-live="polite" aria-label="Loading video"></div>

<style>
  .loading-spinner {
    position: absolute;
    width: 50px;
    height: 50px;
    border: 5px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: spin 1s ease-in-out infinite;
    z-index: 4;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
