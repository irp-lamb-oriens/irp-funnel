<script lang="ts">
  import CTAButton from "./Header/CTAButton.svelte";
  import { cubicOut, cubicIn } from "svelte/easing";
  import { writable, get } from "svelte/store";
  export let faqs: { question: string; answer: string }[] = [];
  export let moreFaqs: { question: string; answer: string }[] = [];
  let allFaqs = [...faqs, ...moreFaqs]
    .filter(
      (faq, idx, arr) =>
        arr.findIndex(f => f.question === faq.question && f.answer === faq.answer) === idx
    )
    .map((faq, idx) => ({ ...faq, idx }));
  let faqOpen = Array(allFaqs.length).fill(false);
  faqOpen[0] = true;
  let showMore = false;
  let searchTerm = "";

  // Respect reduced motion in the JS-driven Svelte transitions below.
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // SSR-safe tag stripper (the DOM-based helper below only works in-browser).
  const toPlainText = (html: string) =>
    html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  // FAQPage structured data — eligible for rich results and part of the
  // semantics/SEO line on the Developer Award sheet. `<` is escaped so the
  // JSON can never close the script tag.
  $: faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: toPlainText(f.answer) },
    })),
  }).replace(/</g, "\\u003c");
  function toggleFaq(idx: number) {
    const wasOpen = faqOpen[idx];
    faqOpen = faqOpen.map(() => false);
    if (!wasOpen) {
      faqOpen[idx] = true;
    }
  }

  function stripHtml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  // Helper: split text into lines up to the current typewriter index
  function getTypewriterLines(text: string, chars: number): string[] {
    const visible = text.slice(0, chars);
    return visible.split(/\r?\n/);
  }
  // Helper: calculate clip-path progress for each line (0% to 100%)
  function getLineClipProgress(line: string, lineIdx: number, chars: number): string {
    // Stagger: each line starts after previous is fully revealed
    // For simplicity, reveal all lines up to the current chars, and animate the last line's width
    const lines = getTypewriterLines(line, chars);
    let total = 0;
    for (let i = 0; i < lineIdx; i++) total += lines[i]?.length || 0;
    const lineLength = line.length;
    if (chars >= total + lineLength) return "100%";
    if (chars <= total) return "0%";
    return ((chars - total) / lineLength * 100).toFixed(1) + "%";
  }

  function toggleShowMore() {
    showMore = !showMore;
  }
  $: filteredFaqs = allFaqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      toPlainText(faq.answer).toLowerCase().includes(searchTerm.toLowerCase())
  );
  // Custom transition for FAQ card
  function faqCardTransition(
    node: HTMLElement,
    { delay = 0, direction = 1 }: { delay?: number; direction?: number }
  ) {
    return {
      delay: reduceMotion ? 0 : delay,
      duration: reduceMotion ? 0 : 400,
      easing: direction > 0 ? cubicOut : cubicIn,
      css: (t: number) =>
        `
        opacity: ${t};
        transform: translateY(${direction > 0 ? (1 - t) * 24 : (t - 1) * 24}px) scale(${0.98 + t * 0.02});
        `
    };
  }
  // Animate height: auto for answer
  function faqAnswerTransition(
    node: HTMLElement,
    { delay = 0 }: { delay?: number }
  ) {
    return {
      delay,
      duration: reduceMotion ? 0 : 350,
      easing: cubicOut,
      css: (t: number) => `
        opacity: ${t};
        height: ${t === 1 ? "auto" : t * node.scrollHeight + "px"};
        overflow: hidden;
      `
    };
  }
</script>

<svelte:head>
  <!-- Split tag so preprocessors never mistake this for a component script. -->
  {@html '<scr' + 'ipt type="application/ld+json">' + faqJsonLd + '</scr' + 'ipt>'}
</svelte:head>

<section class="faq-section" id="faq" aria-labelledby="faq-title">
  <div class="row faq-row">
    <div class="col col-image faq-col-image">
      <img src="/FAQs.jpg" alt="" width="400" height="565" class="faq-image" loading="lazy" decoding="async" />
    </div>
    <div class="col col-faq faq-col-faq">
      <h2 class="faq-title" id="faq-title">Frequently asked questions</h2>
      <p class="faq-description">
        We want to offer you a better experience by sweeping away all of your concerns and save you time to focus on your relocation, that’s why we came up with this organized collection of valuable information about our products and services.
      </p>
      <div class="faq-search-row">
        <label class="faq-sr" for="faq-search">Search frequently asked questions</label>
        <input
          id="faq-search"
          type="search"
          class="faq-search-input"
          placeholder="Search FAQs..."
          autocomplete="off"
          bind:value={searchTerm}
        />
        <p class="faq-sr" aria-live="polite">
          {#if searchTerm}{filteredFaqs.length} {filteredFaqs.length === 1 ? 'question matches' : 'questions match'}{/if}
        </p>
      </div>
      <!-- Accordion pattern: the <button> is the only control (aria-expanded +
           aria-controls). Previously the card div also had a click handler and
           the button had an Enter keydown, so Enter toggled twice = no-op. -->
      <div class="faq-list">
        {#each filteredFaqs.slice(0, showMore ? filteredFaqs.length : 4) as faq, i (faq.idx)}
          <div
            class="faq-item"
            class:open={faqOpen[faq.idx]}
            transition:faqCardTransition={{ delay: i * 60, direction: faqOpen[faq.idx] ? 1 : -1 }}
          >
            <h3 class="faq-question-heading">
              <button
                class="faq-question"
                class:active={faqOpen[faq.idx]}
                type="button"
                id="faq-q-{faq.idx}"
                aria-expanded={faqOpen[faq.idx]}
                aria-controls="faq-a-{faq.idx}"
                on:click={() => toggleFaq(faq.idx)}
              >
                <span>{faq.question}</span>
                <span class="faq-chevron" aria-hidden="true"></span>
              </button>
            </h3>
            {#if faqOpen[faq.idx]}
              <!-- Answers are trusted, authored constants: render their HTML
                   (bold, line breaks) instead of a letter-by-letter strip. -->
              <div
                class="faq-answer"
                id="faq-a-{faq.idx}"
                role="region"
                aria-labelledby="faq-q-{faq.idx}"
                transition:faqAnswerTransition={{}}
              >
                {@html allFaqs[faq.idx].answer}
              </div>
            {/if}
          </div>
        {:else}
          <p class="faq-empty">
            No questions match “{searchTerm}”. Ask us directly in your free consultation.
          </p>
        {/each}
      </div>
      {#if filteredFaqs.length > 4}
        <div class="faq-show-more">
          <button type="button" class="show-more-toggle" aria-expanded={showMore} on:click={toggleShowMore}>
            {showMore ? 'Show fewer questions' : `Show all ${filteredFaqs.length} questions`}
          </button>
        </div>
      {/if}
      <div class="button-row faq-button-row">
        <CTAButton trigger={true} label="Book a consultation" href="/consultation/" variant="primary" />
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.faq-section {
  background: #f8f8f8;
  padding: 2.5rem 0;
  .faq-row {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
  }
  .faq-col-image {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    .faq-image {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      max-width: 100%;
      height: auto;
      transition: box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);
      &:hover {
        box-shadow: 0 4px 16px rgba(30,144,255,0.18);
      }
    }
  }
  .faq-col-faq {
    flex: 1 1 60%;
    .faq-title {
      color: var(--color-highlight-1);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.2rem;
      letter-spacing: -0.5px;
    }
    .faq-description {
      color: #444;
      font-size: 1.08rem;
      margin-bottom: 1.2rem;
    }
    .faq-search-row {
      margin-bottom: 1.2rem;
      .faq-search-input {
        width: 100%;
        padding: 0.6rem 1rem;
        border-radius: 6px;
        border: 1px solid #d0d0d0;
        font-size: 1rem;
        transition: border-color 0.2s, box-shadow 0.2s;
        &:focus {
          border-color: var(--color-highlight-1);
          box-shadow: 0 0 0 2px rgba(30,144,255,0.08);
          outline: none;
        }
      }
    }
    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }
    .faq-question-heading {
      margin: 0;
      font: inherit;
    }
    .faq-item {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.05);
      padding: 1rem;
      transition:
        box-shadow 0.25s cubic-bezier(0.4,0,0.2,1),
        transform 0.35s cubic-bezier(0.4,0,0.2,1);
      position: relative;
      opacity: 1;
      &:hover, &.open {
        box-shadow: 0 4px 16px rgba(30,144,255,0.18);
        transform: translateY(-2px) scale(1.01);
        z-index: 2;
      }
      &.open {
        border: 1.5px solid var(--color-highlight-1);
      }
      .faq-question {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: none;
        border: none;
        padding: 0;
        text-align: left;
        width: 100%;
        font-size: 1.08rem;
        font-weight: 700;
        color: var(--color-highlight-1);
        margin: 0;
        cursor: pointer;
        transition: color 0.2s, text-shadow 0.2s;
        outline: none;
        &.active, &:focus {
          color: #156dc1;
          text-shadow: 0 2px 8px rgba(30,144,255,0.08);
        }
        &:focus-visible {
          outline: 2px solid var(--color-highlight-1);
          outline-offset: 4px;
          border-radius: 4px;
        }
      }
      .faq-chevron {
        flex: 0 0 auto;
        width: 0.6rem;
        height: 0.6rem;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(45deg);
        transition: transform 0.25s ease;
      }
      .faq-question.active .faq-chevron {
        transform: rotate(-135deg);
      }
      .faq-answer {
        margin-top: 0.5rem;
        font-size: 1rem;
        color: #444;
        overflow: hidden;
        transition:
          opacity 0.35s cubic-bezier(0.4,0,0.2,1),
          height 0.35s cubic-bezier(0.4,0,0.2,1);
        will-change: opacity, height;
      }
    }
    .faq-empty {
      color: #555;
      font-size: 1rem;
    }
    .faq-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .faq-show-more {
      margin: 1rem 0;
      .show-more-toggle {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: var(--color-highlight-1);
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
        transition: color 0.2s;
        &:hover, &:focus {
          color: #156dc1;
        }
      }
    }
    .faq-button-row {
      display: flex;
      gap: 1rem;
      margin-top: 1.2rem;
      flex-wrap: wrap;
    }
  }
}
@media (max-width: 1200px) {
  .faq-row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .faq-col-faq, .faq-col-image {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .faq-section .faq-col-faq .faq-item,
  .faq-section .faq-col-faq .faq-item .faq-chevron {
    transition: none;
  }
  .faq-section .faq-col-faq .faq-item:hover,
  .faq-section .faq-col-faq .faq-item.open {
    transform: none;
  }
}
@media (max-width: 700px) {
  .faq-section {
    padding: 2.2rem 0;
  }
  .faq-item {
    padding: 0.8rem;
  }
  .faq-title {
    font-size: 1.3rem !important;
  }
}
</style>
