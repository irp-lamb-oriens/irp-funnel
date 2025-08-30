<script lang="ts">
  // No props for now, but could be made data-driven if needed
  import CTAButton from "./Header/CTAButton.svelte";
</script>

<section class="moving-process">
  <div class="row">
    <div class="col col-left">
      <h2>Our Easy Moving Process</h2>
      <div class="card">
        <p>Our moving process is base on a simple but powerful truth. Every move overseas is the combination of a sequence of steps that need to be planed, followup, and controlled.</p>
      </div>
      <div class="card">
        <p>We treat every move for that it is, a complex project to be coordinated. Applying the best project management practices and our proprietary relocation management system.</p>
      </div>
    </div>
    <div class="col col-timeline">
      <div class="timeline">
        <div class="timeline-step">
          <img src="/icons/phone-80-3.png" width="80" height="80" alt="Relocation conference call" />
          <h5>Relocation conference call</h5>
        </div>
        <div class="timeline-step">
          <img src="/icons/support.png" width="80" height="80" alt="Personalized Relocation Plan" />
          <h5>Personalized Relocation Plan</h5>
        </div>
        <div class="timeline-step">
          <img src="/icons/location.png" width="80" height="80" alt="Timeline Relocation tracking and follow up" />
          <h5>Timeline Relocation tracking and follow up</h5>
        </div>
        <div class="timeline-step">
          <img src="/icons/followup.png" width="80" height="80" alt="Continues support during your relocation" />
          <h5>Continues support during your relocation</h5>
        </div>
      </div>
    </div>
  </div>
  <div class="row button-row">
    <div class="col">
      <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
    </div>
    <div class="col">
      <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
    </div>
  </div>
</section>

<style lang="scss">
.moving-process {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    .timeline-step {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.05);
      padding: 1rem;
      img {
        width: 60px;
        height: 60px;
        object-fit: contain;
      }
      h5 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-highlight-1);
        margin: 0;
      }
    }
  }
}
.button-row {
  display: flex;
  gap: 1rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}
.cta-btn, .primary-btn {
  background: var(--color-highlight-1);
  color: #fff;
  display: inline-block;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  &:hover {
    background: var(--color-outline);
  }
}
.primary-btn {
  background: var(--color-highlight-1);
  color: #fff;
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-left, .col-timeline {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
  .timeline {
    align-items: center;
  }
}
@media (max-width: 700px) {
  .moving-process {
    padding: 1.2rem 0;
  }
  .card {
    padding: 0.8rem;
  }
}
</style>
