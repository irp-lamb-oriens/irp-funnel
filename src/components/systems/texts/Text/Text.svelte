<script lang="ts">
  import type { TextType } from "../../../types.ts";
  import RevealText from "../RevealText/RevealText.svelte";
  import TextTypes from "../TextTypes/TextTypes.svelte";

  export let text: string = "";
  export let type: TextType = "paragraph";
  export let block: boolean = false;
  export let canReveal = false;

  $: canReveal;
</script>

<span class="text" class:block>
  <TextTypes {type}>
    <RevealText {text} {canReveal} />
  </TextTypes>
</span>

<style lang="scss">
  .text {
    &.block {
      display: block;
    }
  }
</style>
