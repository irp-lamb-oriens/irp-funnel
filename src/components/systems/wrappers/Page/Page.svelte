<script lang="ts">
  import { onMount, setContext } from "svelte";
  let pageDiv: HTMLDivElement | null = null;

  onMount(async () => {
    if (pageDiv) {
      setContext('scrollContainer', pageDiv);
    }
    // if (!(await askIsAuthCodeValid())) {
    //   window.location.href = "/";
    // }
  });
</script>

<div class="page" bind:this={pageDiv}>
  <slot />
</div>

<style lang="scss">
  .page {
    padding: 160px 25px;
    overflow: auto;
    height: 100vh;
    display: grid;
    place-items: center;
    justify-content: center;

    @media (max-width: 1024px) {
      padding: 160px 25px;
    }
  }
</style>
