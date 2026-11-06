<script lang="ts">
  /**
   * Scene 7, "What you get with your project". The list on the left lights
   * one item at a time and the matching device comes to the front on the
   * right: the written plan with the rules that apply, the status page
   * (Relocation Portal), the team's WhatsApp updates, and the scope-change
   * notice. All contents are labelled examples.
   */
  import { scene, seg, easeOut } from './scene.ts';
  import { INCLUDES } from './content.ts';

  let p = 0;
  const N = INCLUDES.items.length;
  $: ip = seg(p, 0.04, 0.94) * N;
  $: a = Math.min(N - 1, Math.floor(ip));
  $: t = Math.min(1, ip - a);
  /** Stacking: the active device in front, the others behind. */
  const ORDER = [0, 1, 2, 2];
  $: front = ORDER[a];

  const RULES = ['Customs and import duties', 'Household goods exemptions', 'Vehicle import regulations', 'Residency and visa options'];
  const STAGES = ['Consultation', 'Quote', 'Payment', 'Packing', 'Shipping', 'Arrival', 'Customs', 'Delivery'];
  const MSGS = [
    { from: 'irp', text: 'Good morning! Packing is booked for Tuesday at 8:00.' },
    { from: 'you', text: 'Perfect, thank you.' },
    { from: 'irp', text: 'Your container left port today. The shipping details are on your status page.' },
    { from: 'irp', text: 'Customs asked for one more document. We will send you the form here.' }
  ];
  $: cur = a === 1 ? 2 + Math.floor(t * 3.99) : a > 1 ? 5 : 2;
  $: shownMsgs = a < 2 ? 1 : a === 2 ? 1 + Math.floor(t * 3.99) : 4;
</script>

<section id="includes" class="scene" style="--len:4" use:scene={(v) => (p = v)} aria-labelledby="includes-title">
  <div class="stage">
    <div class="wrap grid">
      <div class="copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{INCLUDES.eyebrow}</p>
        <h2 class="title" id="includes-title">{INCLUDES.title}</h2>
        <ol class="list">
          {#each INCLUDES.items as item, i}
            <li class:on={a === i} class:done={a > i}>
              <span class="idx">0{i + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          {/each}
        </ol>
      </div>

      <div class="stack" aria-hidden="true">
        <!-- the plan -->
        <div class="dev plan" class:front={front === 0} class:back={front !== 0}>
          <div class="plan-head"><span class="logo">IRP</span><div><b>Relocation plan</b><small>Example</small></div></div>
          <p class="lbl">Rules that apply to you</p>
          {#each RULES as r, k}
            {@const fk = a === 0 ? easeOut(seg(t, k * 0.15, k * 0.15 + 0.4)) : 1}
            <p class="rule" style="opacity:{0.2 + 0.8 * fk}">{r}<span>✓</span></p>
          {/each}
          <p class="lbl">Estimated costs</p>
          <i class="redact" style="transform: scaleX({a === 0 ? easeOut(seg(t, 0.6, 0.9)) : 1})"></i>
          <span class="accept" class:pressed={a > 0 || t > 0.9}>{a > 0 || t > 0.9 ? '✓ Accepted' : 'Accept plan'}</span>
        </div>

        <!-- the status page -->
        <div class="dev portal" class:front={front === 1} class:back={front !== 1}>
          <div class="chrome"><i></i><i></i><i></i><span>Your Relocation Portal</span></div>
          <div class="pbody">
            <div class="callcard"><span>📅 Upcoming Consultation</span><b>Your consultation call is scheduled</b></div>
            <p class="lbl">Current Status</p>
            <ol class="stepper">
              {#each STAGES as s, k}<li class:done={k < cur} class:now={k === cur}><span></span><b>{s}</b></li>{/each}
            </ol>
            <div class="docrow">
              {#each ['Plan', 'Invoice', 'Bill of lading'] as doc, k}
                <span class="doc" class:in={cur >= 3 + k}>{doc}<em>View Document ↗</em></span>
              {/each}
            </div>
          </div>
        </div>

        <!-- WhatsApp -->
        <div class="dev phone" class:front={front === 2} class:back={front !== 2}>
          <div class="wa-head"><span class="wa-av">IRP</span><div><b>IRP team</b><small>online</small></div></div>
          <div class="wa-body">
            {#each MSGS.slice(0, shownMsgs) as m, k (k)}
              <p class="bubble {m.from}">{m.text}<em>{8 + k}:{k % 2 ? '42' : '15'}</em></p>
            {/each}
            {#if a === 3}
              <div class="notice" style="opacity:{easeOut(seg(t, 0.1, 0.4))}; transform: translateY({(1 - easeOut(seg(t, 0.1, 0.4))) * 14}px)">
                <b>Scope change</b>
                <p>Your inventory is larger than estimated. We will confirm the new figure with you before invoicing.</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  @use './tokens' as *;

  .scene { @include scene-shell; background: $color-canvas; }
  .stage { @include stage; display: flex; align-items: center; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .wrap { @include container; }
  .grid { display: grid; gap: $space-8; align-items: center; width: 100%;
    @include lg { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: $space-16; } }
  .copy { display: flex; flex-direction: column; gap: $space-4; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }
  .title { @include heading-xl; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .list { list-style: none; margin: $space-4 0 0; padding: 0; display: flex; flex-direction: column; border-top: 1px solid $color-hairline; }
  .list li {
    display: grid; grid-template-columns: 40px 1fr; gap: $space-3; padding: $space-4 0; border-bottom: 1px solid $color-hairline;
    opacity: 0.35; transition: opacity 400ms $ease;
    h3 { @include heading-md; font-size: clamp(1.1rem, 1.6vw, 1.35rem); }
    p { @include body; font-size: 0.975rem; opacity: 0; }
    &.on { opacity: 1; p { opacity: 1; margin-top: $space-2; } }
    &.done { opacity: 0.6; }
  }
  .idx { font: 0.75rem $font-mono; color: $color-accent-hover; padding-top: 4px; }
  .list li p { max-height: 0; overflow: hidden; transition: max-height 500ms $ease, opacity 400ms, margin 500ms $ease; }
  .list li.on p { max-height: 7rem; }

  /* Devices */
  .stack { position: relative; height: min(520px, 58vh); height: min(520px, 58svh); font-family: $font-sans;
    @media (max-width: 1023px) { display: none; } }
  .dev { position: absolute; transition: transform 800ms $ease, opacity 600ms, filter 600ms; will-change: transform; }
  .dev.back { opacity: 0.55; filter: saturate(0.6); }
  .dev.front { opacity: 1; z-index: 3; }
  .lbl { margin: 10px 0 6px; font: 700 0.58rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-ink-strong; }

  .plan { left: 0; top: 6%; width: 52%; padding: 18px; border-radius: 4px; background: #fdfcf8; box-shadow: 0 40px 60px -30px rgba(14, 47, 54, 0.5);
    transform: rotate(-4deg) translate(-4%, 6%) scale(0.92); }
  .plan.front { transform: rotate(-2deg) translate(4%, 0) scale(1.04); }
  .plan-head { display: flex; gap: 8px; align-items: center; padding-bottom: 8px; border-bottom: 2px solid $color-ink-strong;
    b { display: block; font: 700 0.8rem $font-sans; color: $color-ink-strong; } small { font: 0.58rem $font-mono; text-transform: uppercase; letter-spacing: 0.1em; color: $color-red; } }
  .logo { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; background: $color-ink-strong; color: $color-accent; font: 800 0.55rem $font-mono; }
  .rule { margin: 0 0 4px; padding: 6px 8px; border-radius: 5px; background: #fff; border: 1px solid $color-hairline; font: 600 0.7rem $font-sans; color: $color-ink-strong; display: flex; transition: opacity 200ms;
    span { margin-left: auto; color: #1f7a5c; } }
  .redact { display: block; height: 16px; border-radius: 3px; background: repeating-linear-gradient(90deg, $color-ink-strong 0 8px, #2c4a51 8px 12px); transform-origin: left; }
  .accept { display: inline-block; margin-top: 12px; padding: 6px 14px; border-radius: 999px; background: $color-ink-strong; color: #fff; font: 700 0.7rem $font-sans; transition: all 300ms $ease;
    &.pressed { background: $color-accent; color: $color-ink-strong; } }

  .portal { right: 0; top: 0; width: 72%; border-radius: 12px; overflow: hidden; background: #fff; border: 1px solid $color-hairline; box-shadow: 0 40px 70px -30px rgba(14, 47, 54, 0.5);
    transform: translate(6%, 10%) scale(0.9); }
  .portal.front { transform: translate(0, 4%) scale(1); }
  .chrome { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: $color-ink-strong; color: #fff;
    i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); } span { margin-left: 6px; font: 700 0.68rem $font-sans; } }
  .pbody { padding: 12px 14px 14px; }
  .callcard { padding: 10px 12px; border-radius: 10px; background: linear-gradient(120deg, $color-ink-strong, #14525c); color: #fff;
    span { display: block; font: 0.55rem $font-mono; letter-spacing: 0.1em; text-transform: uppercase; color: $color-accent; } b { font: 700 0.75rem $font-sans; } }
  .stepper { list-style: none; margin: 0 0 10px; padding: 0; display: grid; grid-template-columns: repeat(8, 1fr); position: relative;
    &::before { content: ''; position: absolute; left: 6%; right: 6%; top: 6px; height: 2px; background: $color-hairline; }
    li { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    span { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid $color-hairline-strong; z-index: 1; transition: all 300ms $ease; }
    b { font: 600 0.5rem $font-sans; color: $color-muted; text-align: center; }
    li.done span { background: $color-accent; border-color: $color-accent; }
    li.now span { border: 3px solid $color-accent; box-shadow: 0 0 0 4px rgba(2, 181, 187, 0.2); }
    li.now b { color: $color-ink-strong; font-weight: 800; } }
  .docrow { display: flex; gap: 6px; }
  .doc { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid $color-hairline; font: 700 0.65rem $font-sans; color: $color-ink-strong;
    opacity: 0.25; transition: opacity 300ms;
    &.in { opacity: 1; }
    em { display: block; font: normal 0.55rem $font-sans; color: $color-accent-hover; margin-top: 2px; } }

  .phone { right: 4%; bottom: -4%; width: 34%; min-width: 220px; border-radius: 28px; overflow: hidden; background: #efeae2; border: 8px solid #10232a;
    box-shadow: 0 40px 70px -25px rgba(14, 47, 54, 0.6); transform: translate(10%, 10%) scale(0.9); }
  .phone.front { transform: translate(0, 0) scale(1.02); }
  .wa-head { display: flex; gap: 8px; align-items: center; padding: 10px 12px; background: #075e54; color: #fff;
    b { display: block; font: 700 0.75rem $font-sans; } small { font: 0.6rem $font-sans; opacity: 0.8; } }
  .wa-av { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: $color-accent; color: $color-ink-strong; font: 800 0.55rem $font-mono; }
  .wa-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; min-height: 240px; }
  .bubble { margin: 0; max-width: 85%; padding: 6px 8px 4px; border-radius: 8px; font: 0.68rem/1.35 $font-sans; color: #111; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12);
    animation: pop 400ms $ease both;
    em { display: block; text-align: right; font: normal 0.5rem $font-sans; color: #667; }
    &.irp { align-self: flex-start; background: #fff; border-top-left-radius: 2px; }
    &.you { align-self: flex-end; background: #d9fdd3; border-top-right-radius: 2px; } }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.96); } }
  .notice { padding: 8px 10px; border-radius: 8px; background: #fbecea; border: 1px dashed $color-red;
    b { font: 700 0.62rem $font-mono; letter-spacing: 0.08em; text-transform: uppercase; color: $color-red; } p { margin: 2px 0 0; font: 0.66rem/1.35 $font-sans; color: $color-ink; } }

  @include reduced-motion { .bubble { animation: none; } }

  :global(.rm) {
    .stage { padding-block: $space-24; }
    .list li { opacity: 1; p { max-height: none; opacity: 1; margin-top: $space-2; } }
  }
</style>
