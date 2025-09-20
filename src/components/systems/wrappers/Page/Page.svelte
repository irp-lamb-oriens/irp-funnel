<script lang="ts">
  import { onMount, setContext } from "svelte";
  import Brand from "../../../Brand/Brand.svelte"
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
  .brand {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  .logo {
    width: 200px;
  }

  .page {
    overflow: auto;
    height: 100vh;
    display: grid;
    place-items: center;
    justify-content: center;
    position: relative;

    @media (max-width: 1024px) {
    }
  }
</style>
