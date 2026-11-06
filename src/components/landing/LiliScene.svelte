<script lang="ts">
  /**
   * Scene 5, "Chat with Lily". The conversation types itself as you scroll:
   * a typing indicator before each of Lily's replies, then the booking
   * confirmation flies into a small calendar and fills Thursday.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { rewindToBooking } from './reveal.ts';
  import { LILI, LILI_WHATSAPP } from './content.ts';

  let p = 0;
  const STEP = 0.13;
  const at = (k: number) => 0.1 + k * STEP;
  $: shown = (k: number) => p >= at(k);
  $: typing = LILI.chat.findIndex((m, k) => m.from === 'lili' && p >= at(k) - 0.07 && p < at(k));
  $: booked = p >= at(LILI.chat.length) + 0.02;
  $: fly = easeOut(seg(p, at(LILI.chat.length) + 0.1, at(LILI.chat.length) + 0.24));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const HOURS = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  // Example week: rows are hours from 9:00 (row 0). The two open slots match Lily's offer.
  const BUSY = [
    { day: 0, from: 0, len: 2, title: 'Client call' },
    { day: 0, from: 5, len: 1, title: 'Client call' },
    { day: 1, from: 3, len: 2, title: 'Client call' },
    { day: 2, from: 1, len: 2, title: 'Client call' },
    { day: 2, from: 6, len: 1, title: 'Team' },
    { day: 3, from: 0, len: 1, title: 'Team' },
    { day: 3, from: 3, len: 1, title: 'Client call' },
    { day: 4, from: 2, len: 2, title: 'Client call' },
    { day: 4, from: 6, len: 2, title: 'Client call' }
  ];
  const OFFERED = [{ day: 1, from: 1 }, { day: 3, from: 6 }];
</script>

<section id="lili" class="scene" style="--len:3" use:scene={(v) => (p = v)} aria-labelledby="lili-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{LILI.eyebrow}</p>
        <h2 class="title" id="lili-title">{LILI.title}</h2>
        <p class="lead">{LILI.body}</p>
        <div class="actions">
          <a class="primary" href="#hero-form" on:click={rewindToBooking}>{LILI.primary}</a>
          <a class="ghost" href={LILI_WHATSAPP} target="_blank" rel="noopener">{LILI.secondary}</a>
        </div>
      </div>

      <div class="device" aria-label="Example conversation with Lily" role="img">
        <div class="chat">
          <div class="chat-bar">
            <img class="chat-avatar" src="/lili.png" alt="" width="40" height="40" />
            <div><p class="chat-name">Lily</p><p class="chat-status"><span class="chat-live"></span>{typing >= 0 ? 'typing…' : 'Online'}</p></div>
            <span class="chat-example">Example</span>
          </div>
          <ul class="msgs" aria-hidden="true">
            {#each LILI.chat as m, k}
              {#if typing === k}
                <li class="msg lili typing"><i></i><i></i><i></i></li>
              {/if}
              <li class="msg {m.from}" class:in={shown(k)}>{m.text}</li>
            {/each}
            <li class="msg booked" class:in={booked} style="transform: translate({fly * 85}%, {fly * -20}px) scale({1 - fly * 0.6}); opacity:{booked ? 1 - fly : 0}">
              <span class="check">✓</span> Consultation booked: Thursday, 15:00
            </li>
          </ul>
        </div>

        <div class="cal" class:in={p > at(1)} aria-hidden="true">
          <header class="cal-head">
            <span class="g-logo"><i></i><i></i><i></i><i></i></span>
            <p class="cal-title">Team calendar</p>
            <span class="cal-week">This week · Example</span>
          </header>
          <div class="week">
            <span class="corner"></span>
            {#each DAYS as d, i}<span class="dname" style="grid-column:{i + 2}; grid-row:1">{d}<b>{10 + i}</b></span>{/each}
            {#each HOURS as h, r}
              <span class="hour" style="grid-column:1; grid-row:{r + 2}">{h}</span>
              {#each DAYS as _, i}<span class="cell" style="grid-column:{i + 2}; grid-row:{r + 2}"></span>{/each}
            {/each}
            {#each BUSY as e}
              <span class="ev busy" style="grid-column:{e.day + 2}; grid-row:{e.from + 2} / span {e.len}">{e.title}</span>
            {/each}
            {#each OFFERED as o, k}
              <span class="ev offer" class:show={p > at(2) - 0.04 && !(k === 1 && fly > 0.85)} style="grid-column:{o.day + 2}; grid-row:{o.from + 2} / span 1">Open</span>
            {/each}
            <span class="ev booked-ev" class:show={fly > 0.85} style="grid-column:5; grid-row:8 / span 1">
              <b>IRP consultation</b><small>15:00 to 16:00 · Google Meet</small>
            </span>
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
  .chat { @include card; overflow: hidden; box-shadow: 0 40px 80px -40px rgba(14, 47, 54, 0.45); max-width: 560px;
    @include lg { width: 60%; } }
  .chat-bar { display: flex; align-items: center; gap: $space-3; padding: $space-4 $space-6; border-bottom: 1px solid $color-hairline; background: $color-canvas; }
  .chat-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .chat-name { font: 700 1rem $font-sans; color: $color-ink-strong; margin: 0; }
  .chat-status { font: 0.8rem $font-sans; color: $color-muted; margin: 0; display: flex; align-items: center; gap: 6px; }
  .chat-live { width: 7px; height: 7px; border-radius: 50%; background: #1f9d6b; }
  .chat-example { margin-left: auto; font: 0.7rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
  .msgs { list-style: none; margin: 0; padding: $space-6; display: flex; flex-direction: column; gap: $space-3; min-height: min(380px, 44vh); min-height: min(380px, 44svh); }
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
    position: absolute; right: -2%; top: 14%; width: min(400px, 50%); padding: 14px 14px 12px; border-radius: 14px;
    background: #fff; color: $color-ink; border: 1px solid $color-hairline; font-family: $font-sans;
    box-shadow: 0 40px 70px -30px rgba(14, 47, 54, 0.55);
    opacity: 0; transform: translateY(24px) rotate(1.5deg); transition: opacity 500ms $ease, transform 700ms $ease;
    &.in { opacity: 1; transform: rotate(1.5deg); }
    @media (max-width: 1023px) { display: none; }
  }
  .cal-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .g-logo { width: 22px; height: 22px; border-radius: 5px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; background: $color-mist;
    i { border-radius: 2px; } i:nth-child(1) { background: #4285f4; } i:nth-child(2) { background: #ea4335; } i:nth-child(3) { background: #34a853; } i:nth-child(4) { background: #fbbc04; } }
  .cal-title { margin: 0; font: 700 0.85rem $font-sans; color: $color-ink-strong; }
  .cal-week { margin-left: auto; font: 0.6rem $font-mono; letter-spacing: 0.08em; text-transform: uppercase; color: $color-muted; }
  .week { display: grid; grid-template-columns: 34px repeat(5, 1fr); grid-template-rows: 32px repeat(8, 28px); position: relative; }
  .corner { grid-column: 1; grid-row: 1; }
  .dname { grid-row: 1; text-align: center; font: 600 0.6rem $font-sans; color: $color-muted; text-transform: uppercase; letter-spacing: 0.06em;
    b { display: block; font: 700 0.85rem $font-sans; color: $color-ink-strong; } }
  .hour { grid-column: 1; font: 0.52rem $font-mono; color: $color-muted; transform: translateY(-5px); }
  .cell { border-top: 1px solid $color-hairline; border-left: 1px solid $color-hairline; }
  .ev { margin: 1px 2px; border-radius: 4px; padding: 2px 4px; font: 600 0.56rem/1.2 $font-sans; overflow: hidden; z-index: 1; }
  .busy { background: #e6ecee; color: $color-steel; border-left: 3px solid #9fb0b8; }
  .offer { background: transparent; border: 1.5px dashed $color-accent; color: $color-accent-hover; display: grid; place-items: center;
    opacity: 0; transform: scale(0.9); transition: opacity 300ms, transform 400ms $ease;
    &.show { opacity: 1; transform: none; } }
  .booked-ev { background: $color-accent; color: $color-ink-strong; border-left: 3px solid $color-ink-strong; display: flex; flex-direction: column; justify-content: center; padding: 3px 6px;
    opacity: 0; transform: scale(0.6); transform-origin: center; transition: opacity 350ms, transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
    &.show { opacity: 1; transform: none; box-shadow: 0 8px 18px -6px rgba(2, 181, 187, 0.7); }
    b { font: 800 0.6rem $font-sans; } small { font: 0.52rem $font-sans; white-space: nowrap; } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .msg { opacity: 1; transform: none; }
    .booked { opacity: 1 !important; transform: none !important; }
    .typing { display: none; }
    .cal { position: static; margin-top: $space-6; opacity: 1; transform: none; }
    .offer, .booked-ev { opacity: 1; transform: none; }
  }
</style>
