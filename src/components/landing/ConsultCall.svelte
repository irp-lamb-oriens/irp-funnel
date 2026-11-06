<script lang="ts">
  /**
   * Station 1 of "How it works": an example consultation call. A photo of a
   * client on a video call (Pexels, free licence; static/landing/
   * consult-call.*) with the call's transcript writing itself as the visitor
   * scrolls: each line appears with its timestamp, the newest one types out,
   * and the notes are saved to the client's file at the end. Driven by `lp`,
   * the station's 0..1 progress, so scrolling back rewinds it.
   *
   * Decorative: the parent hides the whole piece from screen readers; the
   * step's own text carries the meaning.
   */
  export let lp = 0;
  /** True while this station is on screen (runs the idle loops). */
  export let live = false;

  type Line = { who: 'irp' | 'you'; at: string; text: string };
  const LINES: Line[] = [
    { who: 'irp', at: '00:08', text: 'Thanks for making the time. Tell me about your move.' },
    { who: 'you', at: '00:21', text: 'We are moving from Dallas to San José next spring. We are retiring.' },
    { who: 'irp', at: '01:02', text: 'Then we start with your residency status. It decides what you pay at customs.' },
    { who: 'you', at: '01:40', text: 'Can we bring our SUV? It is a 2019.' },
    { who: 'irp', at: '02:15', text: 'Yes. The import tax depends on its value and its year. I will put the numbers in your plan.' },
    { who: 'you', at: '02:58', text: 'And our two dogs?' },
    { who: 'irp', at: '03:20', text: 'They need a vet health certificate before the flight. I am adding it to your checklist.' }
  ];
  const START = 0.04;
  const STEP = 0.125;
  const TYPE = 0.1;
  const WHO = { irp: 'Ana · IRP', you: 'You' };

  $: count = LINES.filter((_, k) => lp >= START + k * STEP).length;
  $: cur = count - 1;
  $: typed = cur >= 0 ? Math.min(1, (lp - (START + cur * STEP)) / TYPE) : 0;
  $: saved = lp >= START + LINES.length * STEP;
  $: elapsed = cur >= 0 ? LINES[cur].at : '00:00';
  /** The photo settles in as the station plays. */
  $: zoom = 1.06 - 0.06 * Math.min(1, lp * 1.4);
</script>

<div class="cc" class:live>
  <figure class="photo">
    <picture>
      <source type="image/webp" srcset="/landing/consult-call-760.webp 760w, /landing/consult-call.webp 1125w" sizes="(min-width: 1024px) 700px, 92vw" />
      <img src="/landing/consult-call.jpg" alt="" width="1125" height="750" loading="lazy" decoding="async" style="transform: scale({zoom})" />
    </picture>
    <span class="rec-chip"><i></i>Recording · {elapsed}</span>
  </figure>

  <!-- The transcript floats over the quiet, dark lower-left of the photo. -->
  <div class="tr">
    <div class="tr-head">
      <span class="tr-dot" class:on={!saved}></span>
      <b>Transcript</b>
      <span class="tr-state">{saved ? 'Saved' : 'Live'}</span>
    </div>
    <ol class="tr-lines">
      {#each LINES.slice(0, count) as l, k (k)}
        <li class={l.who}>
          <p class="meta"><b>{WHO[l.who]}</b><time>{l.at}</time></p>
          <p class="txt">
            {k === cur ? l.text.slice(0, Math.ceil(l.text.length * typed)) : l.text}{#if k === cur && typed < 1}<i class="caret"></i>{/if}
          </p>
        </li>
      {/each}
    </ol>
    <p class="tr-foot" class:on={saved}>
      <svg viewBox="0 0 16 16"><path style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" d="M3.5 8.5l3 3 6-7" /></svg>
      Saved to your client file
    </p>
  </div>
</div>

<style lang="scss">
  @use './tokens' as *;

  /* Width also follows the screen height, so the photo never runs under the heading on short screens. */
  .cc { position: relative; width: min(700px, 100%, calc((100vh - 300px) * 1.35)); width: min(700px, 100%, calc((100svh - 300px) * 1.35)); padding: 0 0 26px 48px; }

  .photo {
    position: relative; margin: 0; border-radius: 22px; overflow: hidden; aspect-ratio: 3 / 2; background: #dfe6e8;
    box-shadow: 0 50px 90px -50px rgba(14, 47, 54, 0.7), 0 0 0 1px rgba(14, 47, 54, 0.06);
    img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 60% 50%; transform-origin: 70% 45%; will-change: transform; }
    &::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(200deg, rgba(14, 47, 54, 0) 55%, rgba(14, 47, 54, 0.28) 100%); }
  }
  .rec-chip {
    position: absolute; left: 14px; top: 14px; z-index: 1; display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 11px; border-radius: 99px; background: rgba(10, 24, 28, 0.62); color: #fff;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    font: 600 0.68rem $font-mono; letter-spacing: 0.06em; font-variant-numeric: tabular-nums;
    i { width: 7px; height: 7px; border-radius: 50%; background: #ff5a5f; }
  }
  .live .rec-chip i { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }

  /* Transcript card */
  .tr {
    position: absolute; left: 0; bottom: 0; z-index: 2; width: min(300px, 46%); height: 66%;
    display: flex; flex-direction: column; border-radius: 18px; overflow: hidden;
    background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
    box-shadow: 0 30px 60px -28px rgba(14, 47, 54, 0.6), 0 0 0 1px rgba(14, 47, 54, 0.06);
  }
  .tr-head {
    display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px; border-bottom: 1px solid $color-hairline;
    b { font: 700 0.8rem $font-sans; color: $color-ink-strong; }
  }
  .tr-dot { width: 8px; height: 8px; border-radius: 50%; background: $color-accent; transition: background 300ms; &.on { background: #ff5a5f; } }
  .live .tr-dot.on { animation: pulse 1.6s ease-in-out infinite; }
  .tr-state { margin-left: auto; font: 600 0.6rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-muted; }
  .tr-lines {
    list-style: none; margin: 0; padding: 10px 14px; flex: 1; min-height: 0; overflow: hidden;
    display: flex; flex-direction: column; justify-content: flex-end; gap: 10px;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 40px); mask-image: linear-gradient(to bottom, transparent 0, #000 40px);
    li { animation: line-in 380ms $ease both; padding-left: 10px; border-left: 2px solid $color-hairline; }
    li.irp { border-left-color: $color-accent; }
  }
  @keyframes line-in { from { opacity: 0; transform: translateY(8px); } }
  .meta {
    margin: 0 0 2px; display: flex; align-items: baseline; gap: 8px;
    b { font: 700 0.64rem $font-sans; color: $color-ink-strong; }
    time { font: 0.58rem $font-mono; color: $color-muted; font-variant-numeric: tabular-nums; }
  }
  .irp .meta b { color: #04767b; }
  .txt { margin: 0; font: 400 0.74rem/1.45 $font-sans; color: $color-ink; }
  .caret { display: inline-block; width: 1.5px; height: 0.95em; margin-left: 1px; background: $color-ink-strong; vertical-align: -2px; animation: caret 0.9s steps(1) infinite; }
  @keyframes caret { 50% { opacity: 0; } }
  .tr-foot {
    margin: 0; display: flex; align-items: center; gap: 6px; padding: 9px 14px; border-top: 1px solid $color-hairline;
    font: 700 0.64rem $font-sans; color: $color-muted; transition: color 300ms, background 300ms;
    svg { width: 13px; height: 13px; opacity: 0.4; transition: opacity 300ms; }
    &.on { color: #04767b; background: $color-accent-soft; svg { opacity: 1; } }
  }

  @include reduced-motion {
    .photo img { transform: none !important; }
    .live .rec-chip i, .live .tr-dot.on, .caret { animation: none; }
    .tr-lines li { animation: none; }
  }
</style>
