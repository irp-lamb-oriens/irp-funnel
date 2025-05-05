<script lang="ts">
  import type { TextType } from "../../../types.ts";

  export let type: TextType;
</script>

<span class="text-type text-type--{type}">
  <slot />
</span>

<style lang="scss">
  @use "./TextTypes.scss";
</style>
