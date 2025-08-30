<script lang="ts">
  import CTAButton from "./Header/CTAButton.svelte";
  export let faqs: { question: string; answer: string }[] = [];
  export let moreFaqs: { question: string; answer: string }[] = [];
  let faqOpen = Array(faqs.length + moreFaqs.length).fill(false);
  faqOpen[0] = true;
  let showMore = false;
  function toggleFaq(idx: number) {
    faqOpen[idx] = !faqOpen[idx];
  }
  function toggleShowMore() {
    showMore = !showMore;
  }
</script>

<section class="faq-section">
  <div class="row">
    <div class="col col-image">
      <img src="/FAQs.jpg" alt="FAQs" width="400" height="565" />
    </div>
    <div class="col col-faq">
      <h2>Frequently Asked Question</h2>
      <p>We want to offer you a better experience by sweeping away all of your concerns and save you time to focus on your relocation, that’s why we came up with this organized collection of valuable information about our products and services.</p>
      <div class="faq-list">
        {#each faqs as faq, i}
          <div class="faq-item" class:open={faqOpen[i]}>
            <h5 on:click={() => toggleFaq(i)} class="faq-question">{faq.question}</h5>
            {#if faqOpen[i]}
              <div class="faq-answer">
                {@html faq.answer}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="faq-show-more">
        <a href="#" class="show-more-toggle" on:click|preventDefault={toggleShowMore}>
          {showMore ? 'Show Less' : 'Show More'}
        </a>
      </div>
      {#if showMore}
        <div class="faq-list faq-list-more">
          {#each moreFaqs as faq, j}
            <div class="faq-item" class:open={faqOpen[faqs.length + j]}>
              <h5 on:click={() => toggleFaq(faqs.length + j)} class="faq-question">{faq.question}</h5>
              {#if faqOpen[faqs.length + j]}
                <div class="faq-answer">
                  {@html faq.answer}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      <div class="button-row">
        <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.faq-section {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .col-image {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    img {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      max-width: 100%;
      height: auto;
    }
  }
  .col-faq {
    flex: 1 1 60%;
    h2 {
      color: var(--color-highlight-1);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.2rem;
    }
    .faq-list, .faq-list-more {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }
    .faq-item {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.05);
      padding: 1rem;
      cursor: pointer;
      transition: box-shadow 0.15s;
      &.open {
        box-shadow: 0 2px 12px rgba(30,144,255,0.12);
      }
      .faq-question {
        font-size: 1.08rem;
        font-weight: 700;
        color: var(--color-highlight-1);
        margin: 0;
        cursor: pointer;
      }
      .faq-answer {
        margin-top: 0.5rem;
        font-size: 1rem;
        color: #444;
      }
    }
    .faq-show-more {
      margin: 1rem 0;
      .show-more-toggle {
        color: var(--color-highlight-1);
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
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
.cta-btn {
  background: var(--color-highlight-1);
  color: #fff !important;
  padding: 0.5rem 1.2rem;
  border-radius: 4px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
  margin-left: 0.5rem;
  display: inline-block;
  cursor: pointer;
}
.cta-btn:hover,
.cta-btn:focus {
  background: #156dc1;
  outline: none;
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-faq, .col-image {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (max-width: 700px) {
  .faq-section {
    padding: 1.2rem 0;
  }
  .faq-item {
    padding: 0.8rem;
  }
  h2 {
    font-size: 1.3rem !important;
  }
}
</style>
