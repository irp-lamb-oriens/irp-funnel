<script lang="ts">
  /**
   * Scene 12, questions. A calm beat: the header stays put on the left while
   * the questions rise in one after another. Answers open and close with a
   * smooth height animation (grid rows 0fr to 1fr); one answer is open at a
   * time and the open row is marked by a sliding accent bar. Buttons with
   * aria-expanded/aria-controls, so it works with a keyboard and a screen
   * reader. Q&A text is the previous home's FAQ, unchanged.
   */
  import { reveal } from './reveal.ts';
  import { FAQ } from './content.ts';

  let open = 0;
  const toggle = (i: number) => (open = open === i ? -1 : i);

  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.items.map((f: { q: string; a: string }) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }
    }))
  });
</script>

<svelte:head>
  {@html '<scr' + 'ipt type="application/ld+json">' + faqJsonLd + '</scr' + 'ipt>'}
</svelte:head>

<section class="section" id="faq" aria-labelledby="faq-title">
  <div class="wrap split">
    <div class="head" use:reveal>
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{FAQ.eyebrow}</p>
      <h2 class="title" id="faq-title">{FAQ.title}</h2>
      <p class="count" aria-hidden="true"><b>{String(FAQ.items.length).padStart(2, '0')}</b> questions</p>
      <a class="ticket" href={FAQ.checklist.href} target="_blank" rel="noopener">
        <span class="ticket-main"><small>Free</small>{FAQ.checklist.label}</span>
        <span class="ticket-stub" aria-hidden="true">↓</span>
      </a>
    </div>

    <ul class="list">
      {#each FAQ.items as f, i}
        <li class="item" class:open={open === i} use:reveal style="--d:{i * 70}ms">
          <h3>
            <button
              type="button"
              id="faq-q-{i}"
              aria-expanded={open === i}
              aria-controls="faq-a-{i}"
              on:click={() => toggle(i)}
            >
              <span class="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span class="q">{f.q}</span>
              <span class="icon" aria-hidden="true"><i></i><i></i></span>
            </button>
          </h3>
          <div class="answer" id="faq-a-{i}" role="region" aria-labelledby="faq-q-{i}" inert={open !== i}>
            <div class="answer-inner">
              <p>{@html f.a}</p>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .section { @include section; & { background: $color-mist; } }
  .wrap { @include container; }
  .split { display: grid; gap: $space-8;
    @include lg { grid-template-columns: 0.85fr 1.15fr; gap: $space-24; align-items: start; } }
  .head { display: flex; flex-direction: column; gap: $space-4; @include reveal(18px);
    @include lg { position: sticky; top: 120px; } }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; }
  .count { margin: 0; font: 0.75rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted;
    b { font: 800 1.4rem $font-sans; color: $color-ink-strong; margin-right: 4px; letter-spacing: -0.02em; } }

  .ticket { align-self: flex-start; margin-top: $space-2; display: flex; text-decoration: none; color: $color-ink-strong;
    filter: drop-shadow(0 18px 24px rgba(14, 47, 54, 0.18)); @include focus-ring; }
  .ticket-main { display: flex; flex-direction: column; gap: 2px; padding: 14px 20px; background: #fff; border-radius: 12px 0 0 12px; font: 700 1rem $font-sans; transition: transform 400ms $ease;
    small { font: 0.65rem $font-mono; letter-spacing: 0.14em; text-transform: uppercase; color: $color-accent-hover; } }
  .ticket-stub { display: grid; place-items: center; width: 56px; background: $color-accent; border-radius: 0 12px 12px 0; border-left: 2px dashed rgba(14, 47, 54, 0.35); font: 700 1.2rem $font-sans; transition: transform 400ms $ease; }
  @media (hover: hover) {
    .ticket:hover .ticket-stub { transform: translate(6px, 4px) rotate(8deg); }
    .ticket:hover .ticket-main { transform: rotate(-1deg); }
  }

  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .item {
    position: relative; border-radius: 16px; background: rgba(255, 255, 255, 0.55); border: 1px solid $color-hairline;
    transition: background 500ms $ease, box-shadow 500ms $ease, border-color 500ms;
    @include reveal(22px, var(--d));
    &::before { content: ''; position: absolute; left: -1px; top: 18px; bottom: 18px; width: 3px; border-radius: 3px; background: $color-accent; transform: scaleY(0); transform-origin: top; transition: transform 600ms $ease; }
    &.open { background: #fff; border-color: transparent; box-shadow: 0 24px 50px -30px rgba(14, 47, 54, 0.45); }
    &.open::before { transform: scaleY(1); }
    @include hover-only { &:not(.open):hover { background: rgba(255, 255, 255, 0.9); } }
  }
  h3 { margin: 0; }
  button {
    width: 100%; display: grid; grid-template-columns: 34px 1fr 28px; gap: $space-3; align-items: center; text-align: left;
    padding: 18px 20px; border: 0; background: none; cursor: pointer; border-radius: 16px; color: $color-ink-strong;
    @include focus-ring;
  }
  .num { font: 0.72rem $font-mono; color: $color-muted; transition: color 300ms; }
  .open .num { color: $color-accent-hover; }
  .q { font: 700 clamp(1rem, 1.4vw, 1.12rem)/1.35 $font-sans; }
  .icon { position: relative; width: 28px; height: 28px; border-radius: 50%; background: $color-mist; transition: background 400ms, transform 600ms $ease;
    i { position: absolute; left: 8px; right: 8px; top: 13px; height: 2px; border-radius: 2px; background: $color-ink-strong; transition: transform 600ms $ease; }
    i:last-child { transform: rotate(90deg); } }
  .open .icon { background: $color-accent; transform: rotate(180deg); i:last-child { transform: rotate(0deg); } }

  .answer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 600ms $ease; }
  .open .answer { grid-template-rows: 1fr; }
  .answer-inner { overflow: hidden; min-height: 0; }
  .answer p {
    @include body; margin: 0; padding: 0 20px 20px calc(20px + 34px + #{$space-3}); max-width: 64ch;
    opacity: 0; transform: translateY(-6px); transition: opacity 300ms ease, transform 500ms $ease;
    :global(strong) { color: $color-ink-strong; }
  }
  .open .answer p { opacity: 1; transform: none; transition-delay: 150ms; }

  @include reduced-motion {
    .answer, .answer p, .icon, .icon i, .item::before { transition: none; }
  }
</style>
