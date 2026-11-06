<script lang="ts">
  /**
   * Landing narrator (Svelte port of the ILP narrator). Pablo's recorded
   * voice walks the visitor through the home: an offer card on the first
   * visit, a player bar with his voice wave (also the play/pause control),
   * running captions shown word by word, and a page that scrolls with the
   * voice. While a cue narrates, the page moves from its section's top to
   * where the section's bottom meets the bar, so the section ends as its
   * narration does; at the next cue it fades through to the next section.
   * Scrolling by hand pauses the voice; Resume returns to the same moment.
   * When the narration ends the page rewinds to the booking form.
   *
   * Nothing plays until the visitor presses play. Pablo is heard, never
   * shown: the player has no portrait.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    HOME_CUES,
    aboutMinutes,
    cueAt,
    cueStarts,
    followY,
    lineOf,
    lineStarts,
    revealedCount,
    sectionRange,
    speechEnds,
    type Range,
    type TimedWord,
    type Transcript
  } from './narration.ts';
  import { openBooking } from '../landing/reveal.ts';

  export let audioSrc = '/narration/home.mp3';
  export let transcriptSrc = '/narration/home.json';
  export let cues = HOME_CUES;
  /** The section the narration ends on (the booking form). */
  export let endAnchor = 'hero-form';

  const OFFER_KEY = 'irp-narration-offer-home';
  const HEADER_OFFSET = 88;
  const MASK_MS = 260;

  type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

  let audio: HTMLAudioElement;
  let bar: HTMLElement;
  let canvas: HTMLCanvasElement;
  let status: Status = 'loading';
  let offer = false;
  let barOpen = false;
  let pausedByScroll = false;
  let muted = false;
  let captionsOn = true;
  let masking = false;

  let words: TimedWord[] = [];
  let lines: number[] = [];
  let starts: number[] = [];
  let ends: number[] = [];
  let ranges: Range[] = [];
  let duration = 0;

  // Per-frame view state
  let t = 0;
  let cueIndex = 0;
  let lineIndex = 0;
  let shown = 0;

  let raf = 0;
  let lastY = -1;
  let lastCue = -1;
  let programmatic = false;
  let reduce = false;

  // Voice wave
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freq: Uint8Array | null = null;

  const BARS = 5;

  $: lineWords = lines.length ? words.slice(lines[lineIndex], lineIndex + 1 < lines.length ? lines[lineIndex + 1] : words.length) : [];
  $: lineFirst = lines.length ? lines[lineIndex] : 0;
  $: progress = duration ? t / duration : 0;
  $: about = aboutMinutes(duration || 108);

  function storage(get: boolean, value = '1') {
    try {
      if (get) return localStorage.getItem(OFFER_KEY);
      localStorage.setItem(OFFER_KEY, value);
    } catch {
      /* private mode */
    }
    return null;
  }

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    load();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    // Scrolling by hand pauses the voice.
    const intent = (e: Event) => {
      if (status !== 'playing') return;
      if (bar && e.target instanceof Node && bar.contains(e.target)) return;
      if (e instanceof KeyboardEvent) {
        if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) return;
        // Typing in a field (the booking form, the chat) is not scrolling.
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      }
      pause(true);
    };
    window.addEventListener('wheel', intent, { passive: true });
    window.addEventListener('touchmove', intent, { passive: true });
    window.addEventListener('keydown', intent);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      ro.disconnect();
      window.removeEventListener('wheel', intent);
      window.removeEventListener('touchmove', intent);
      window.removeEventListener('keydown', intent);
    };
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') cancelAnimationFrame(raf);
    ctx?.close().catch(() => {});
  });

  async function load() {
    try {
      const res = await fetch(transcriptSrc);
      const data = (await res.json()) as Transcript;
      words = data.words;
      duration = data.duration;
      lines = lineStarts(words.map((w) => w.word));
      starts = cueStarts(cues, words, duration);
      ends = speechEnds(starts, words, duration);
      status = 'ready';
      await tick();
      measure();
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const robot = (navigator as Navigator & { webdriver?: boolean }).webdriver;
      if (wide && !robot && !storage(true)) offer = true;
    } catch {
      status = 'error';
    }
  }

  function measure() {
    if (!starts.length) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const reserve = barOpen && bar ? bar.getBoundingClientRect().height + 24 : 0;
    document.documentElement.style.setProperty('--narrator-reserve', `${reserve}px`);
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    ranges = cues.map((c) => {
      const el = document.getElementById(c.anchor);
      if (!el) return { topY: 0, endY: 0 };
      const r = el.getBoundingClientRect();
      return sectionRange(r.top + window.scrollY, r.height, vh, reserve, maxScroll, c.anchor === 'hero-form' ? 0 : HEADER_OFFSET);
    });
  }

  /* ── Playback ─────────────────────────────────────────────── */

  function setupWave() {
    if (ctx || !audio) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      analyser = null;
    }
  }

  async function start(from = 0) {
    offer = false;
    storage(false, 'played');
    barOpen = true;
    pausedByScroll = false;
    setupWave();
    await ctx?.resume().catch(() => {});
    await tick();
    measure();
    audio.currentTime = from;
    t = from;
    lastCue = -1;
    await glideTo(followY(ranges, starts, ends, from));
    play();
  }

  function play() {
    pausedByScroll = false;
    audio.play().then(
      () => {
        status = 'playing';
        loop();
      },
      () => {
        status = 'paused';
      }
    );
  }

  function pause(byScroll = false) {
    audio?.pause();
    status = 'paused';
    pausedByScroll = byScroll;
    cancelAnimationFrame(raf);
    draw(true);
  }

  async function resume() {
    if (status === 'ended') return start(0);
    await glideTo(followY(ranges, starts, ends, audio.currentTime));
    lastCue = cueAt(starts, audio.currentTime);
    play();
  }

  function toggle() {
    if (status === 'playing') pause();
    else if (status === 'paused' || status === 'ended') resume();
    else start(0);
  }

  async function seekTime(target: number) {
    audio.pause();
    cancelAnimationFrame(raf);
    const time = Math.max(0, Math.min(duration - 0.05, target));
    audio.currentTime = time;
    update(time);
    lastCue = cueAt(starts, time);
    await glideTo(followY(ranges, starts, ends, time));
    play();
  }

  const seekCue = (i: number) => seekTime(starts[Math.max(0, Math.min(cues.length - 1, i))] + 0.01);

  function seekBar(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekTime(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
  }

  function exit() {
    audio.pause();
    cancelAnimationFrame(raf);
    status = 'ready';
    barOpen = false;
    pausedByScroll = false;
    document.documentElement.style.setProperty('--narrator-reserve', '0px');
  }

  function decline() {
    offer = false;
    storage(false, 'declined');
  }

  /** Offer dialog: focus the play button on open, Escape declines, Tab stays inside. */
  function dialog(node: HTMLElement) {
    const prev = document.activeElement as HTMLElement | null;
    node.querySelector<HTMLElement>('.offer-play')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        decline();
      } else if (e.key === 'Tab') {
        const f = Array.from(node.querySelectorAll<HTMLElement>('button'));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    node.addEventListener('keydown', onKey);
    return { destroy() { node.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); } };
  }

  async function onEnded() {
    cancelAnimationFrame(raf);
    status = 'ended';
    draw(true);
    // Back to the booking form the narration started on.
    const el = document.getElementById(endAnchor);
    if (el) {
      const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
      await glideTo(y, 1400);
      openBooking(el);
    }
  }

  /* ── Frame loop ───────────────────────────────────────────── */

  function update(time: number) {
    t = time;
    cueIndex = cueAt(starts, time);
    shown = revealedCount(words, time + 0.02);
    const current = Math.max(0, shown - 1);
    lineIndex = lineOf(lines, current);
  }

  function loop() {
    cancelAnimationFrame(raf);
    const frame = () => {
      if (status !== 'playing') return;
      update(audio.currentTime);
      follow();
      draw(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function follow() {
    const i = cueIndex;
    const y = followY(ranges, starts, ends, t);
    if (i !== lastCue) {
      const jump = Math.abs(window.scrollY - y) > 2;
      lastCue = i;
      if (jump) {
        teleport(y);
        return;
      }
    }
    if (reduce || masking) return;
    if (Math.abs(y - lastY) >= 0.5) scrollInstant(y);
  }

  function scrollInstant(y: number) {
    programmatic = true;
    lastY = y;
    window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    requestAnimationFrame(() => (programmatic = false));
  }

  /** Cut to the next section behind a short fade in the page colour. */
  function teleport(y: number) {
    if (reduce) return scrollInstant(y);
    masking = true;
    window.setTimeout(() => {
      scrollInstant(followY(ranges, starts, ends, audio.currentTime));
      window.setTimeout(() => (masking = false), 40);
    }, MASK_MS / 2);
  }

  /** Eased scroll to y (resume, seek, rewind). */
  function glideTo(y: number, ms = 700): Promise<void> {
    return new Promise((resolve) => {
      const from = window.scrollY;
      const d = y - from;
      if (reduce || Math.abs(d) < 2) {
        scrollInstant(y);
        return resolve();
      }
      const t0 = performance.now();
      programmatic = true;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo({ top: from + d * e, behavior: 'instant' as ScrollBehavior });
        if (p < 1) requestAnimationFrame(step);
        else {
          lastY = y;
          programmatic = false;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /* ── Voice wave ───────────────────────────────────────────── */

  function draw(idle: boolean) {
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (analyser && freq && !idle) analyser.getByteFrequencyData(freq);
    const gap = 3;
    const bw = (w - gap * (BARS - 1)) / BARS;
    for (let k = 0; k < BARS; k++) {
      let level = 0.18;
      if (!idle) {
        if (analyser && freq) {
          const bin = freq[2 + k * 3] ?? 0;
          level = Math.max(0.18, bin / 255);
        } else {
          level = 0.25 + 0.5 * Math.abs(Math.sin(performance.now() / 180 + k));
        }
      }
      const bh = Math.max(4, level * h);
      g.fillStyle = '#02b5bb';
      const x = k * (bw + gap);
      const y = (h - bh) / 2;
      g.beginPath();
      if (typeof g.roundRect === 'function') g.roundRect(x, y, bw, bh, bw / 2);
      else g.rect(x, y, bw, bh);
      g.fill();
    }
  }

  $: if (canvas && status !== 'playing') draw(true);

  /* ── Caption word state ───────────────────────────────────── */

  function wordState(k: number, time: number): 'past' | 'now' | 'next' {
    const w = words[k];
    if (!w || time < w.start) return 'next';
    if (time >= w.end) return 'past';
    return 'now';
  }
  /** Share of the current word already spoken (fills the word left to right, syllable by syllable). */
  function wordProgress(k: number, time: number): number {
    const w = words[k];
    if (!w) return 0;
    return Math.min(1, Math.max(0, (time - w.start) / Math.max(0.05, w.end - w.start)));
  }

  const pad = (n: number) => String(n).padStart(2, '0');
</script>

<audio bind:this={audio} src={audioSrc} preload="metadata" muted={muted} on:ended={onEnded}></audio>

<div class="mask" class:on={masking} aria-hidden="true"></div>

{#if offer}
  <div class="offer-backdrop">
    <div class="offer" role="dialog" aria-modal="true" aria-labelledby="narrator-offer-title" use:dialog>
      <p class="offer-eyebrow">International Relocation Partner</p>
      <h2 id="narrator-offer-title">Let Pablo walk you through it.</h2>
      <p class="offer-sub">The founder explains how we plan your move, {about}, with sound.</p>
      <button class="offer-play" on:click={() => start(0)} aria-label="Play the narrated tour of this page, {about}, with sound">
        <span class="offer-icon" aria-hidden="true">▶</span>Play the narrated tour
      </button>
      <button class="offer-read" on:click={decline}>Read the page instead</button>
    </div>
  </div>
{/if}

{#if !barOpen && status !== 'loading' && status !== 'error'}
  <button class="launcher" on:click={() => start(0)} aria-label="Play the narrated tour, {about}">
    <span class="launcher-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    Listen to Pablo
  </button>
{/if}

{#if barOpen}
  <section class="bar" bind:this={bar} aria-label="Page narration">
    <button class="progress" on:click={seekBar} aria-label="Seek narration">
      <span style="transform: scaleX({progress})"></span>
    </button>

    <button class="wave" on:click={toggle} aria-label={status === 'playing' ? 'Pause narration' : 'Play narration'}>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </button>

    <div class="middle">
      {#if pausedByScroll}
        <div class="paused">
          <span>Paused while you scroll.</span>
          <button class="resume" on:click={resume}>Resume</button>
        </div>
      {:else if captionsOn}
        <p class="caption" aria-live="off">
          {#each lineWords as w, j (lineFirst + j)}
            {@const k = lineFirst + j}
            {@const st = wordState(k, t)}
            <span class="w {st}" style={st === 'now' ? `--p:${wordProgress(k, t)}` : undefined}>{w.word}</span>{' '}
          {/each}
        </p>
      {:else}
        <p class="section-only">{cues[cueIndex].label}</p>
      {/if}
      <p class="meta">{pad(cueIndex + 1)} / {pad(cues.length)} · {cues[cueIndex].label}</p>
    </div>

    <div class="controls">
      <button on:click={() => seekCue(cueIndex - 1)} aria-label="Previous section" disabled={cueIndex === 0}>‹</button>
      <button on:click={() => seekCue(cueIndex + 1)} aria-label="Next section" disabled={cueIndex === cues.length - 1}>›</button>
      <button on:click={() => (muted = !muted)} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
      <button on:click={() => (captionsOn = !captionsOn)} aria-label={captionsOn ? 'Hide captions' : 'Show captions'} aria-pressed={captionsOn}>CC</button>
      <button class="exit" on:click={exit} aria-label="Exit narration">✕</button>
    </div>
  </section>
{/if}

<style lang="scss">
  @use '../landing/tokens' as *;

  .mask {
    position: fixed; inset: 0; z-index: 90; pointer-events: none;
    background: $color-canvas; opacity: 0;
    transition: opacity 130ms cubic-bezier(0.4, 0, 1, 1);
    &.on { opacity: 1; transition-duration: 110ms; }
  }

  /* ── Offer ── */
  .offer-backdrop {
    position: fixed; inset: 0; z-index: 120;
    display: grid; place-items: center;
    background: rgba(14, 47, 54, 0.55);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: fade 400ms $ease both;
  }
  .offer {
    width: min(520px, calc(100vw - 2rem));
    background: $color-ink-strong; color: $color-on-dark;
    border: 1px solid $color-on-dark-hairline; border-radius: 22px;
    padding: 2.75rem 2.5rem 2rem; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 1rem;
    box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5);
    animation: rise 600ms $ease both;
    h2 { font-family: $font-sans; font-weight: 700; font-size: 2rem; letter-spacing: -0.03em; line-height: 1.1; margin: 0; color: $color-on-dark; }
  }
  .offer-eyebrow { @include eyebrow; color: $color-accent; }
  .offer-sub { font-family: $font-sans; color: $color-on-dark-muted; margin: 0 0 0.5rem; line-height: 1.5; }
  .offer-play { @include button-primary; & { padding-inline: 2rem; } }
  .offer-icon { font-size: 0.8rem; }
  .offer-read {
    background: none; border: none; cursor: pointer; color: $color-on-dark-muted;
    font-family: $font-sans; font-size: 0.9rem; text-decoration: underline; text-underline-offset: 3px;
    @include focus-ring;
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(16px) scale(0.98); } }

  /* ── Launcher ── */
  .launcher {
    position: fixed; left: 1rem; bottom: 1rem; z-index: 80;
    display: inline-flex; align-items: center; gap: 0.6rem;
    padding: 0.7rem 1.1rem 0.7rem 0.9rem; border-radius: $radius-pill;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: $color-ink-strong; color: $color-on-dark;
    font-family: $font-sans; font-weight: 600; font-size: 0.9rem; cursor: pointer;
    box-shadow: 0 12px 30px -10px rgba(14, 47, 54, 0.6);
    @include focus-ring;
    transition: transform 200ms $ease;
    &:hover { transform: translateY(-2px); }
  }
  .launcher-wave {
    display: inline-flex; align-items: center; gap: 2px; height: 16px;
    i { width: 3px; border-radius: 2px; background: $color-accent; animation: idle 1.4s ease-in-out infinite; }
    i:nth-child(1) { height: 40%; }
    i:nth-child(2) { height: 90%; animation-delay: 0.15s; }
    i:nth-child(3) { height: 60%; animation-delay: 0.3s; }
    i:nth-child(4) { height: 80%; animation-delay: 0.45s; }
  }
  @keyframes idle { 50% { transform: scaleY(0.45); } }

  /* ── Player bar ── */
  .bar {
    position: fixed; z-index: 100; left: 50%; bottom: 1rem; transform: translateX(-50%);
    width: min(860px, calc(100vw - 1.5rem));
    display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1rem;
    padding: 0.85rem 1rem 0.85rem 0.85rem;
    background: rgba(14, 47, 54, 0.92); color: $color-on-dark;
    backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid $color-on-dark-hairline; border-radius: 18px;
    box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.55);
    animation: rise 500ms $ease both;
    overflow: hidden;
  }
  .progress {
    position: absolute; left: 0; right: 0; top: 0; height: 4px; padding: 0; border: none; cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    span { display: block; height: 100%; background: $color-accent; transform-origin: left; }
  }
  .wave {
    width: 52px; height: 52px; border-radius: 14px; border: 1px solid $color-on-dark-hairline;
    background: rgba(255, 255, 255, 0.05); padding: 12px 11px; cursor: pointer;
    canvas { width: 100%; height: 100%; display: block; }
    @include focus-ring;
  }
  .middle { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .caption {
    margin: 0; font-family: $font-sans; font-weight: 600; letter-spacing: -0.01em;
    font-size: clamp(1rem, 1.6vw, 1.25rem); line-height: 1.35; min-height: 1.35em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .w { display: inline-block; font-family: $font-sans; transition: opacity 160ms ease, transform 220ms $ease; }
  .w.next { opacity: 0; transform: translateY(6px); }
  .w.past { color: $color-on-dark; }
  .w.now {
    --p: 0;
    background: linear-gradient(90deg, $color-accent calc(var(--p) * 100%), rgba(255, 255, 255, 0.45) calc(var(--p) * 100%));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .section-only { margin: 0; font-family: $font-sans; font-weight: 600; }
  .meta { margin: 0; font-family: $font-mono !important; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: $color-on-dark-muted; }
  .paused { display: flex; align-items: center; gap: 0.75rem; color: $color-on-dark-muted; span { font-family: $font-sans; } }
  .resume { @include button-primary; & { min-height: 34px; padding: 0.35rem 1rem; font-size: 0.875rem; } }
  .controls {
    display: flex; gap: 4px;
    button {
      width: 36px; height: 36px; border-radius: 10px; border: none; cursor: pointer;
      background: transparent; color: $color-on-dark; font-size: 1rem; font-family: $font-sans; font-weight: 700;
      &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
      &:disabled { opacity: 0.35; cursor: default; }
      &[aria-pressed='false'] { opacity: 0.55; }
      @include focus-ring;
    }
    button:nth-child(4) { font-size: 0.72rem; letter-spacing: 0.04em; }
  }
  @media (max-width: 640px) {
    .bar { grid-template-columns: auto 1fr; }
    .controls { grid-column: 1 / -1; justify-content: space-between; }
  }
  @include reduced-motion {
    .w, .offer, .bar, .offer-backdrop { transition: none; animation: none; }
    .launcher-wave i { animation: none; }
  }
</style>
