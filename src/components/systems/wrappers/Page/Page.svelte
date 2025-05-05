<script lang="ts">
  import { onMount } from "svelte";

  onMount(async () => {

    // if (!(await askIsAuthCodeValid())) {
    //   window.location.href = "/";
    // }
  });
</script>

<div class="page">
  <slot />
</div>

<style lang="scss">
  .page {
    padding: 160px 25px;
    overflow: auto;
    max-height: 100vh;

    @media (max-width: 1024px) {
      padding: 160px 25px;
    }
  }
</style>
