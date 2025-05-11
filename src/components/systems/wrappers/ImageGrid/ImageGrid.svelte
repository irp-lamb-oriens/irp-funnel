<script lang="ts">
  import RevealOnScroll from '../../texts/RevealOnScroll/RevealOnScroll.svelte';
  export let images: string[] = [];
</script>

<div class="image-grid-wrapper">
  <div class="image-grid">
    {#each images as url (url)}
      <div class="image-row">
        <RevealOnScroll let:revealed>
          {#if typeof revealed !== 'undefined'}
            <script>
              // @ts-ignore
              console.log('[ImageGrid] revealed for', { url, revealed });
            </script>
          {/if}
          <img
            src={url}
            alt="Image"
            class={revealed ? 'revealed-img' : 'reveal-img'}
            data-revealed={revealed}
            data-url={url}
            id={"img-" + btoa(url).replace(/[^a-zA-Z0-9]/g, "")}
          />
        </RevealOnScroll>
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
  padding: 10rem 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  grid-gap: 7rem;
  width: 100%;
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

.reveal-img {
  opacity: 0 !important;
  transform: translateY(50px) !important;
  transition: opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1) !important;
}
.revealed-img {
  opacity: 1 !important;
  transform: translateY(0) !important;
}
</style>
