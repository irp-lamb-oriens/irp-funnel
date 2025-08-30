<script lang="ts">
  // No props for now, but could be made data-driven if needed
  import CTAButton from "./Header/CTAButton.svelte";
</script>

<section class="contact-cta">
  <div class="row">
    <div class="col col-large">
      <h6>Choose the best moving company for your relocation</h6>
      <h2>Contact us & Get a free moving consultation</h2>
    </div>
    <div class="col col-buttons">
      <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
      <CTAButton label="Contact Us" href="/contact-us/" variant="secondary" />
    </div>
  </div>
</section>

<style lang="scss">
.contact-cta {
  background: var(--color-highlight-1);
  color: #fff;
  padding: 2rem 0;
  .row {
    align-items: center;
  }
  h6 {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #fff;
  }
  h2 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: #fff;
  }
  .col-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-end;
    a {
      min-width: 180px;
      text-align: center;
    }
  }
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-large, .col-buttons {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
    align-items: center;
  }
}
@media (max-width: 700px) {
  .contact-cta {
    padding: 1.2rem 0;
  }
}
</style>
