<script lang="ts">
  import RevealOnScroll from '../../texts/RevealOnScroll/RevealOnScroll.svelte';

  export let url: string;
</script>

<RevealOnScroll>
  <img
    src={url}
    alt="Image"
    class="reveal-img"
  />
</RevealOnScroll>

<style>
  .reveal-img {
    max-height: 200px;
    width: 100%;  
  }
</style>