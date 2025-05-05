<script lang="ts">
  import { onMount } from "svelte";
  import { startTicks } from "./ticks.js";

  onMount(async () => {
    startTicks();
  });
</script>
