<script lang="ts">
  // No props for now, but could be made data-driven if needed
  import CTAButton from "./Header/CTAButton.svelte";
</script>

<section class="relocation-philosophy">
  <div class="row">
    <div class="col col-left">
      <h4>How Moving overseas should be!</h4>
      <h2>Every successful relocation is a well planed project</h2>
      <p>We have developed a system to ensure our customers have a complete overview of their relocation journey, from our initial consultation to the delivery of the household goods to the final destination.</p>
      <p>Our goal is to make the journey of thousands of expatriates easier and enjoyable by providing useful information and specialized services, such as:</p>
      <p>Relocation tours</p>
      <ul>
        <li class="service">International Moving Services</li>
        <li class="service">Courier Assistance</li>
        <li class="service">Automobile & Boat Shipping</li>
      </ul>
      <p>Our services are aimed at providing the highest quality with a software designed to show our clients the progress of their entire relocation in a visual timeline, enabling them to better prepare for their travel arrangements, the immigration process, and some other relevant processes.</p>
      <p>​Every day we strive to provide the best customer experience and first-class relocation services.</p>
      <p>Sincerely</p>
      <img src="/sign-itp.jpg" width="184" height="81" alt="Signature" />
      <p>IRP, Chief Executive Officer</p>
      <div class="button-row">
        <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
        <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
      </div>
    </div>
    <div class="col col-right">
      <blockquote>
        “Each and every international move should be efficient, secure, and memorable for you and your family. Your international relocation partner should be accountable for making your move easy and enjoyable.”
      </blockquote>
      <img src="/Group-Picture_resize.jpg" width="900" height="600" alt="Group Picture" />
    </div>
  </div>
</section>

<style lang="scss">
.relocation-philosophy {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .col-left {
    flex: 1 1 60%;
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
      margin: 1rem 0;
      max-width: 184px;
      height: auto;
    }
  }
  .col-right {
    flex: 1 1 40%;
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
}
  .service {
    text-align: left;
  }
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-left, .col-right {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (max-width: 700px) {
  .relocation-philosophy {
    padding: 1.2rem 0;
  }
  .card {
    padding: 0.8rem;
  }
}
</style>
