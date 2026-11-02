<script lang="ts">
  import { onMount } from 'svelte';

  let sectionEl: HTMLElement;
  let videoEl: HTMLVideoElement;
  // Unfold the video once it enters the viewport. IntersectionObserver
  // replaces the old per-frame scroll listener (which also console.logged on
  // every scroll event).
  let unfolded = false;

  onMount(() => {
    if (!('IntersectionObserver' in window)) {
      unfolded = true;
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        // Unfold once and stay open, so a playing video never folds away.
        if (entry.isIntersecting) {
          unfolded = true;
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(sectionEl);
    return () => io.disconnect();
  });
</script>

<section class="testimonials" bind:this={sectionEl} aria-labelledby="testimonials-title">
  <div class="row">
    <div class="col">
      <p class="testimonials__eyebrow">Client story</p>
      <h2 id="testimonials-title">Jill Reed on moving abroad with IRP</h2>
      <!-- preload="metadata": fetch only duration/first frame until the visitor
           presses play, instead of downloading the whole MP4 on page load. -->
      <video
        controls
        playsinline
        preload="metadata"
        width="100%"
        bind:this={videoEl}
        class:unfolded
        aria-label="Video testimonial from IRP client Jill Reed"
      >
        <source type="video/mp4" src="https://storage.googleapis.com/videos-irp-funnels/Copia-de-Jill-Reed-International-Relocation-Partner%20(1).mp4#t=0.1" />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</section>

<style lang="scss">
.testimonials {
  background: #fff;
  padding: 2.5rem 0;
  .testimonials__eyebrow {
    margin: 0 0 0.4rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-highlight-2);
  }
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
@media (prefers-reduced-motion: reduce) {
  .testimonials video,
  .testimonials video.unfolded {
    clip-path: none;
    opacity: 1;
    transition: none;
  }
}
</style>
