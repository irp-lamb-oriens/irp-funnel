<script lang="ts">
  // No props for now, but could be made data-driven if needed
</script>

<section class="testimonials">
  <div class="row">
    <div class="col">
      <h2>What Our Customers Say…</h2>
      <video controls width="100%">
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
  }
}
@media (max-width: 700px) {
  .testimonials {
    padding: 1.2rem 0;
  }
}
</style>
