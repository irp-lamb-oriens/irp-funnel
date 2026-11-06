<script lang="ts">
  import { reveal, goToBooking } from './reveal.ts';
  import SectionHead from './SectionHead.svelte';
  import { LILI, LILI_WHATSAPP } from './content.ts';
</script>

<section class="band" id="lili" aria-labelledby="lili-title">
  <div class="wrap grid">
    <div class="head">
      <SectionHead id="lili-title" eyebrow={LILI.eyebrow} title={LILI.title} lead={LILI.body}>
        <div class="actions">
          <a class="primary" href="#hero-form" on:click={goToBooking}>{LILI.primary}</a>
          <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">{LILI.secondary}</a>
        </div>
      </SectionHead>
    </div>

    <figure class="chat" use:reveal aria-label="Example conversation with Lili">
      <div class="chat-bar">
        <img class="chat-avatar" src="/lili.png" alt="" width="40" height="40" />
        <div><p class="chat-name">Lili</p><p class="chat-status"><span class="chat-live"></span>Online</p></div>
        <span class="chat-example">Example</span>
      </div>
      <ul class="msgs">
        {#each LILI.chat as m, i}
          <li class="msg {m.from}" style="--d:{300 + i * 450}ms">{m.text}</li>
        {/each}
        <li class="msg booked" style="--d:{300 + LILI.chat.length * 450}ms">
          <span class="check" aria-hidden="true">✓</span> Consultation booked. The calendar invite is on its way.
        </li>
      </ul>
    </figure>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .band { @include section; background: $color-mist; }
  .wrap { @include container; }
  .grid {
    display: grid; gap: $space-8; align-items: start;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: $space-16; }
  }
  .head { @include lg { position: sticky; top: 120px; } }
  .actions { display: flex; flex-wrap: wrap; gap: $space-3; margin-top: $space-4; }
  .primary { @include button-primary; }
  .ghost { @include button-ghost; }

  .chat {
    @include card; margin: 0; overflow: hidden;
    opacity: 0; transform: translateY(16px);
    transition: opacity 700ms $ease, transform 900ms $ease;
    &:global(.is-in) { opacity: 1; transform: none; }
  }
  .chat-bar {
    background: $color-canvas; color: $color-ink;
    display: flex; align-items: center; gap: $space-3;
    padding: $space-4 $space-6; border-bottom: 1px solid $color-hairline;
  }
  .chat-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .chat-name { font-family: $font-sans; font-weight: 700; color: $color-ink-strong; margin: 0; }
  .chat-status { font-family: $font-sans; font-size: 0.8rem; color: $color-muted; margin: 0; display: flex; align-items: center; gap: 6px; }
  .chat-live { width: 7px; height: 7px; border-radius: 50%; background: #1f9d6b; }
  .chat-example { margin-left: auto; font-family: $font-mono; font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
  .msgs { list-style: none; margin: 0; padding: $space-6; display: flex; flex-direction: column; gap: $space-3; min-height: 360px; }
  .msg {
    max-width: 78%; padding: $space-3 $space-4; border-radius: 16px;
    font-family: $font-sans; font-size: 0.975rem; line-height: 1.5;
    opacity: 0; transform: translateY(8px);
    transition: opacity 400ms $ease var(--d), transform 500ms $ease var(--d);
  }
  .chat:global(.is-in) .msg { opacity: 1; transform: none; }
  .you { align-self: flex-end; background: $color-ink-strong; color: $color-on-dark; border-bottom-right-radius: 4px; }
  .lili { align-self: flex-start; background: $color-accent-soft; color: $color-ink; border-bottom-left-radius: 4px; }
  .booked {
    align-self: center; max-width: none; background: transparent; border: 1px dashed $color-hairline-strong;
    color: $color-ink-strong; font-weight: 600; font-size: 0.9rem;
  }
  .check { color: #1f9d6b; margin-right: 4px; }
  @include reduced-motion { .chat, .msg { opacity: 1; transform: none; transition: none; } }
</style>
