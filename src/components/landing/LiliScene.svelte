<script lang="ts">
  /**
   * Scene 5, "Chat with Lili". The conversation types itself as you scroll:
   * a typing indicator before each of Lili's replies, then the booking
   * confirmation flies into a small calendar and fills Thursday.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { goToBooking } from './reveal.ts';
  import { LILI, LILI_WHATSAPP } from './content.ts';

  let p = 0;
  const STEP = 0.13;
  const at = (k: number) => 0.1 + k * STEP;
  $: shown = (k: number) => p >= at(k);
  $: typing = LILI.chat.findIndex((m, k) => m.from === 'lili' && p >= at(k) - 0.07 && p < at(k));
  $: booked = p >= at(LILI.chat.length) + 0.02;
  $: fly = easeOut(seg(p, at(LILI.chat.length) + 0.1, at(LILI.chat.length) + 0.24));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
</script>

<section id="lili" class="scene" style="--len:3" use:scene={(v) => (p = v)} aria-labelledby="lili-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{LILI.eyebrow}</p>
        <h2 class="title" id="lili-title">{LILI.title}</h2>
        <p class="lead">{LILI.body}</p>
        <div class="actions">
          <a class="primary" href="#hero-form" on:click={goToBooking}>{LILI.primary}</a>
          <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">{LILI.secondary}</a>
        </div>
      </div>

      <div class="device" aria-label="Example conversation with Lili" role="img">
        <div class="chat">
          <div class="chat-bar">
            <img class="chat-avatar" src="/lili.png" alt="" width="40" height="40" />
            <div><p class="chat-name">Lili</p><p class="chat-status"><span class="chat-live"></span>{typing >= 0 ? 'typing…' : 'Online'}</p></div>
            <span class="chat-example">Example</span>
          </div>
          <ul class="msgs" aria-hidden="true">
            {#each LILI.chat as m, k}
              {#if typing === k}
                <li class="msg lili typing"><i></i><i></i><i></i></li>
              {/if}
              <li class="msg {m.from}" class:in={shown(k)}>{m.text}</li>
            {/each}
            <li class="msg booked" class:in={booked} style="transform: translate({fly * 46}%, {fly * 120}px) scale({1 - fly * 0.6}); opacity:{booked ? 1 - fly : 0}">
              <span class="check">✓</span> Consultation booked: Thursday, 15:00
            </li>
          </ul>
        </div>

        <div class="cal" class:in={p > at(2)} aria-hidden="true">
          <p class="cal-title">Team calendar</p>
          <div class="cal-grid">
            {#each DAYS as d, i}
              <div class="day">
                <span>{d}</span>
                <i class:busy={i === 0 || i === 2}></i>
                <i class:busy={i === 4}></i>
                <i class:slot={i === 3} class:filled={i === 3 && fly > 0.85}>{i === 3 && fly > 0.85 ? '15:00' : ''}</i>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-mist; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: $space-16; }
  }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; }
  .lead { @include body; font-size: 1.125rem; max-width: 44ch; }
  .actions { display: flex; flex-wrap: wrap; gap: $space-3; margin-top: $space-2; }
  .primary { @include button-primary; }
  .ghost { @include button-ghost; }

  .device { position: relative; }
  .chat { @include card; overflow: hidden; box-shadow: 0 40px 80px -40px rgba(14, 47, 54, 0.45); max-width: 560px; }
  .chat-bar { display: flex; align-items: center; gap: $space-3; padding: $space-4 $space-6; border-bottom: 1px solid $color-hairline; background: $color-canvas; }
  .chat-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .chat-name { font: 700 1rem $font-sans; color: $color-ink-strong; margin: 0; }
  .chat-status { font: 0.8rem $font-sans; color: $color-muted; margin: 0; display: flex; align-items: center; gap: 6px; }
  .chat-live { width: 7px; height: 7px; border-radius: 50%; background: #1f9d6b; }
  .chat-example { margin-left: auto; font: 0.7rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
  .msgs { list-style: none; margin: 0; padding: $space-6; display: flex; flex-direction: column; gap: $space-3; min-height: min(380px, 44svh); }
  .msg {
    max-width: 80%; padding: $space-3 $space-4; border-radius: 16px; font: 0.975rem/1.5 $font-sans;
    opacity: 0; transform: translateY(12px) scale(0.98); transition: opacity 350ms $ease, transform 500ms $ease;
    &.in { opacity: 1; transform: none; }
  }
  .you { align-self: flex-end; background: $color-ink-strong; color: $color-on-dark; border-bottom-right-radius: 4px; }
  .lili { align-self: flex-start; background: $color-accent-soft; color: $color-ink; border-bottom-left-radius: 4px; }
  .typing { opacity: 1; transform: none; display: flex; gap: 4px; padding: 14px 16px;
    i { width: 7px; height: 7px; border-radius: 50%; background: $color-muted; animation: dot 1s infinite; }
    i:nth-child(2) { animation-delay: 0.15s; } i:nth-child(3) { animation-delay: 0.3s; }
  }
  @keyframes dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
  .booked { align-self: center; max-width: none; border: 1px dashed $color-hairline-strong; background: #fff; color: $color-ink-strong; font-weight: 700; font-size: 0.9rem; transition: none; }
  .check { color: #1f9d6b; }

  .cal {
    position: absolute; right: 0; bottom: -10%; width: min(330px, 70%); padding: 14px; border-radius: 14px; background: $color-ink-strong; color: $color-on-dark;
    box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6);
    opacity: 0; transform: translateY(20px); transition: opacity 500ms $ease, transform 600ms $ease;
    &.in { opacity: 1; transform: none; }
    @media (max-width: 1023px) { display: none; }
  }
  .cal-title { margin: 0 0 10px; font: 0.7rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-on-dark-muted; }
  .cal-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .day { display: flex; flex-direction: column; gap: 5px;
    span { font: 0.7rem $font-mono; color: $color-on-dark-muted; text-align: center; }
    i { height: 22px; border-radius: 5px; background: rgba(255, 255, 255, 0.07); font: 700 0.65rem/22px $font-mono; text-align: center; font-style: normal; color: $color-ink-strong; transition: background 300ms, transform 400ms $ease; }
    i.busy { background: rgba(255, 255, 255, 0.18); }
    i.slot { outline: 1px dashed rgba(255, 255, 255, 0.35); }
    i.filled { background: $color-accent; outline: none; transform: scale(1.08); }
  }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .msg { opacity: 1; transform: none; }
    .booked { opacity: 1 !important; transform: none !important; }
    .typing { display: none; }
    .cal { position: static; margin-top: $space-6; opacity: 1; transform: none; }
  }
</style>
