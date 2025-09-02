<script lang="ts">
  import { onMount } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
  let sectionEl: HTMLElement;
  let videoEl: HTMLVideoElement;
  let unfolded: Writable<boolean> = writable(false);

  function handleScroll() {
    if (!sectionEl) return;
    const rect = sectionEl.getBoundingClientRect();
    // Unfold when the top of the section is below the top of the viewport
    unfolded.set(Math.abs(rect.y) < sectionEl.clientHeight);
    console.log($unfolded)
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    // Initial check in case already in view
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  });
</script>

<section class="testimonials" bind:this={sectionEl}>
  <div class="row">
    <div class="col">
      <h2>What Our Customers Say…</h2>
      <video
        controls
        width="100%"
        bind:this={videoEl}
        class:unfolded={$unfolded}
      >
        <source type="video/mp4" src="https://storage.googleapis.com/videos-irp-funnels/Copia-de-Jill-Reed-International-Relocation-Partner%20(1).mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</section>

<style lang="scss">
.testimonials {
  background: #fff;
  padding: 2.5rem 0;
  h2 {
    color: var(--color-highlight-1);
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1.2rem;
  }
  video {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    max-width: 100%;
    margin: 0 auto;
    display: block;
    /* Unfold animation setup */
    clip-path: inset(50% 25% 50% 25% round 8px);
    transition:
      clip-path 1.1s cubic-bezier(0.77, 0, 0.175, 1),
      opacity 0.3s 0.2s;
    opacity: 0.7;
  }
  video.unfolded {
    clip-path: inset(0% 0% 0% 0% round 8px);
    opacity: 1;
    transition:
      clip-path 1.1s cubic-bezier(0.77, 0, 0.175, 1),
      opacity 0.3s 0.5s;
  }
}
@media (max-width: 700px) {
  .testimonials {
    padding: 1.2rem 0;
  }
}
</style>
