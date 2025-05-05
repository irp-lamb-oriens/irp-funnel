<script lang="ts">
  import shader from "../T.shader";
  import ShaderToy from "../ShaderToy.svelte";
</script>

<div class="shader">
  <ShaderToy {shader} iChannel0={"./Texto Latino Negativo.jpg"} />
</div>

<style>
  .shader {
    filter: var(--bg-filter);
    position: fixed;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
