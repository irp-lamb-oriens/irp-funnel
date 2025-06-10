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
  .logo {
    width: 200px;
    padding: 100px 0;
  }

  .page {
    overflow: auto;
    height: 100vh;
    display: grid;
    place-items: center;
    justify-content: center;
    padding: 100px 0;

    @media (max-width: 1024px) {
    }
  }
</style>
