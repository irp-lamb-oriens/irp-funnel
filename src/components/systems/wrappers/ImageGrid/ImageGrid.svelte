<script lang="ts">
  import RevealingImage from './RevealingImage.svelte';
  export let images: string[] = [];
</script>

<div class="image-grid-wrapper">
  <div class="image-grid">
    {#each images as url (url)}
      <div class="image-row">
        <RevealingImage url={url} />
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
.image-grid-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3.5rem 1rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  grid-gap: 7rem;
  width: 100%;
  filter: grayscale(100%) invert(1);

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    grid-gap: 3rem;
    width: 100%;
    padding: 25px;
  }
}

.image-row {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.image-row img {
  display: block;
  max-width: 200px;
  width: 100%;
  height: auto;
  object-fit: contain;
}
</style>
