<script lang="ts">
  import SectionHead from './SectionHead.svelte';
  import { FAQ } from './content.ts';

  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.items.map((f: { q: string; a: string }) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });
</script>

<svelte:head>
  {@html '<scr' + 'ipt type="application/ld+json">' + faqJsonLd + '</scr' + 'ipt>'}
</svelte:head>

<section class="section" id="faq" aria-labelledby="faq-title">
  <div class="wrap split">
    <div class="head">
      <SectionHead id="faq-title" eyebrow={FAQ.eyebrow} title={FAQ.title}>
        <a class="ticket" href={FAQ.checklist.href} target="_blank" rel="noopener">
          <span class="ticket-main"><small>Free</small>{FAQ.checklist.label}</span>
          <span class="ticket-stub" aria-hidden="true">↓</span>
        </a>
      </SectionHead>
    </div>
    <div class="list">
      {#each FAQ.items as f, i}
        <details open={i === 0}>
          <summary>{f.q}<span class="plus" aria-hidden="true"></span></summary>
          <p>{f.a}</p>
        </details>
      {/each}
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; background: $color-mist; }
  .wrap { @include container; }
  .split {
    display: grid; gap: $space-8;
    @include lg { grid-template-columns: 0.9fr 1.1fr; gap: $space-24; align-items: start; }
  }
  .head { @include lg { position: sticky; top: 120px; } }
  .ticket {
    align-self: flex-start; margin-top: $space-4; display: flex; text-decoration: none; color: $color-ink-strong;
    filter: drop-shadow(0 18px 24px rgba(14, 47, 54, 0.18)); @include focus-ring;
  }
  .ticket-main {
    display: flex; flex-direction: column; gap: 2px; padding: 14px 20px; background: #fff; border-radius: 12px 0 0 12px;
    font: 700 1rem $font-sans; transition: transform 400ms $ease;
    small { font: 0.65rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent-hover; }
  }
  .ticket-stub {
    display: grid; place-items: center; width: 56px; background: $color-accent; border-radius: 0 12px 12px 0;
    border-left: 2px dashed rgba(14, 47, 54, 0.35); font: 700 1.2rem $font-sans; transition: transform 400ms $ease;
  }
  @media (hover: hover) {
    .ticket:hover .ticket-stub { transform: translate(6px, 4px) rotate(8deg); }
    .ticket:hover .ticket-main { transform: rotate(-1deg); }
  }
  .list { border-top: 1px solid $color-hairline; }
  details { border-bottom: 1px solid $color-hairline; }
  summary {
    list-style: none; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center; gap: $space-6;
    padding-block: $space-6;
    font-family: $font-sans; font-weight: 700; font-size: 1.125rem; color: $color-ink-strong;
    @include focus-ring;
    &::-webkit-details-marker { display: none; }
  }
  .plus {
    position: relative; flex: none; width: 16px; height: 16px;
    &::before, &::after { content: ''; position: absolute; left: 0; right: 0; top: 7px; height: 2px; background: $color-ink-strong; transition: transform 300ms $ease; }
    &::after { transform: rotate(90deg); }
  }
  details[open] .plus::after { transform: rotate(0deg); }
  details p { @include body; padding-bottom: $space-6; max-width: 62ch; }
</style>
