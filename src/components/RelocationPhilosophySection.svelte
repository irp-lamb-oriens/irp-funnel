<script lang="ts">
  // No props for now, but could be made data-driven if needed
  import CTAButton from "./Header/CTAButton.svelte";
  import GroupImageMagnifier from "./GroupImageMagnifier.svelte";
</script>

<section class="relocation-philosophy">
  <div class="row">
    <div class="col col-left">
      <h4 class="relocation-philosophy__h4">How Moving overseas should be!</h4>
      <h2 class="relocation-philosophy__h2">Every successful relocation is a well planed project</h2>
      <p class="relocation-philosophy__desc">We have developed a system to ensure our customers have a complete overview of their relocation journey, from our initial consultation to the delivery of the household goods to the final destination.</p>
      <p class="relocation-philosophy__desc">Our goal is to make the journey of thousands of expatriates easier and enjoyable by providing useful information and specialized services, such as:</p>
      <p class="relocation-philosophy__desc">Relocation tours</p>
      <ul class="relocation-philosophy__list">
        <li class="service">International Moving Services</li>
        <li class="service">Courier Assistance</li>
        <li class="service">Automobile & Boat Shipping</li>
      </ul>
      <p class="relocation-philosophy__desc">Our services are aimed at providing the highest quality with a software designed to show our clients the progress of their entire relocation in a visual timeline, enabling them to better prepare for their travel arrangements, the immigration process, and some other relevant processes.</p>
      <p class="relocation-philosophy__desc">​Every day we strive to provide the best customer experience and first-class relocation services.</p>
      <p class="relocation-philosophy__desc">Sincerely</p>
      <img class="relocation-philosophy__signature" src="/sign-itp.jpg" width="184" height="81" alt="Signature" />
      <p class="relocation-philosophy__desc">IRP, Chief Executive Officer</p>
      <div class="button-row">
        <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
        <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
      </div>
    </div>
    <div class="col col-right">
      <blockquote class="relocation-philosophy__quote">
        “Each and every international move should be efficient, secure, and memorable for you and your family. Your international relocation partner should be accountable for making your move easy and enjoyable.”
      </blockquote>
      <GroupImageMagnifier
        src="/1.png"
        alt="Group Picture"
        width="900"
        height="600"
      />
    </div>
  </div>
</section>

<style lang="scss">
.relocation-philosophy {
  background: #fff;
  padding: 2.5rem 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: stretch;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.col-left, .col-right {
  min-width: 0;
  text-align: left;
  padding: 2rem;
}

.col-left {
  h4 {
    color: var(--color-highlight-2);
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 0.7rem;
  }
  h2 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1rem;
    color: #222;
  }
  ul {
    margin-bottom: 1rem;
    li {
      font-size: 1.05rem;
    }
  }
  img {
    max-width: 184px;
    height: auto;
  }
}

.col-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  blockquote {
    font-size: 1.1rem;
    color: #444;
    font-style: italic;
    margin-bottom: 1.5rem;
    background: #e6f2ff;
    border-left: 4px solid var(--color-highlight-1);
    padding: 1rem 1.5rem;
    border-radius: 6px;
    width: 100%;
  }
  img {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    max-width: 100%;
    height: auto;
  }
}

/* Filled-in styles for all markup classes */
.relocation-philosophy__h4 {
  color: var(--color-highlight-2);
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.7rem;
  letter-spacing: 0.01em;
}

.relocation-philosophy__h2 {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: #222;
  line-height: 1.2;
}

.relocation-philosophy__desc {
  font-size: 1.05rem;
  color: #333;
  margin-bottom: 0.7rem;
  line-height: 1.6;
}

.relocation-philosophy__list {
  margin-bottom: 1rem;
  padding-left: 1.2rem;
  list-style: disc inside;
}

.relocation-philosophy__signature {
  margin: 0;
  max-width: 184px;
  height: auto;
  display: block;
}

.button-row {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.relocation-philosophy__quote {
  font-size: 1.1rem;
  color: #444;
  font-style: italic;
  margin-bottom: 1.5rem;
  background: #e6f2ff;
  border-left: 4px solid var(--color-highlight-1);
  padding: 1rem 1.5rem;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}

.relocation-philosophy__group-img {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  max-width: 100%;
  height: auto;
}

.service {
  text-align: left;
}
@media (max-width: 900px) {
  .relocation-philosophy {
    &__signature {
      margin: auto;
    }
  }
  .row {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 0 1rem;
  }
  .col-left, .col-right {
    padding: 2rem;
    text-align: left;
  }
  .button-row {
    justify-content: center;
  }
}

@media (max-width: 700px) {
  .relocation-philosophy {
    padding: 1.2rem 0;
  }
  .row {
    gap: 1.2rem;
    text-align: left;
  }
  .card {
    padding: 2rem;
  }
}
</style>
