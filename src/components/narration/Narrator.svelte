<script lang="ts">
  /**
   * Landing narrator (Svelte port of the ILP narrator). Pablo's recorded
   * voice walks the visitor through the home: an offer dialog on the first
   * visit, a launcher, and a player bar with running captions, a chaptered
   * timeline, speed, a transcript and a page that scrolls with the voice.
   * While a cue narrates, the page moves from its section's top to where the
   * section's bottom meets the bar, so the section ends as its narration
   * does; at the next cue it fades through to the next section. Scrolling by
   * hand pauses the voice; Resume returns to the same moment. When the
   * narration ends the page rewinds to the booking form.
   *
   * Nothing plays until the visitor presses play. Pablo is heard, never
   * shown: the player has no portrait.
   *
   * Accessibility
   * - Every control is a native button with a name; icon-only buttons get a
   *   visible tooltip on hover and keyboard focus (Escape hides it).
   * - The timeline is a slider: arrows move 5 s, Page Up/Down move a
   *   section, Home/End go to the ends; aria-valuetext reads time + section.
   * - Shortcuts work only while focus is inside the player (WCAG 2.1.4):
   *   K play/pause, J/L back/forward 10 s, M mute, C captions, T transcript.
   * - The transcript is the text alternative for the audio (WCAG 1.2.1).
   * - State changes are announced in a polite live region.
   * - The offer dialog traps focus, makes the page inert and returns focus.
   * - Reduced motion, forced colours and more-contrast are handled in CSS.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import {
    HOME_CUES,
    aboutMinutes,
    cueAt,
    cueStarts,
    followY,
    formatTime,
    lineOf,
    lineStarts,
    nextRate,
    revealedCount,
    sectionRange,
    speechEnds,
    spokenTime,
    transcriptSections,
    type Range,
    type TimedWord,
    type Transcript,
    type TranscriptSection
  } from './narration.ts';
  import { jumpToBooking, openBooking } from '../landing/reveal.ts';

  export let audioSrc = '/narration/home.mp3';
  export let transcriptSrc = '/narration/home.json';
  export let cues = HOME_CUES;
  /** The section the narration ends on (the booking form). */
  export let endAnchor = 'hero-form';

  const OFFER_KEY = 'irp-narration-offer-home';
  const PREFS_KEY = 'irp-narration-prefs';
  const HEADER_OFFSET = 88;
  const MASK_MS = 260;
  const STEP = 5; // slider arrow step, seconds
  const JUMP = 10; // J / L, seconds

  type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

  let audio: HTMLAudioElement;
  let bar: HTMLElement;
  let canvas: HTMLCanvasElement;
  let playBtn: HTMLButtonElement;
  let launcherBtn: HTMLButtonElement;
  let transcriptBtn: HTMLButtonElement;
  let transcriptList: HTMLElement;
  let status: Status = 'loading';
  let offer = false;
  let barOpen = false;
  let pausedByScroll = false;
  let buffering = false;
  let audioError = false;
  let muted = false;
  let captionsOn = true;
  let rate = 1;
  let transcriptOpen = false;
  let tipsHidden = false;
  let masking = false;
  let announcement = '';

  let words: TimedWord[] = [];
  let lines: number[] = [];
  let starts: number[] = [];
  let ends: number[] = [];
  let ranges: Range[] = [];
  let sections: TranscriptSection[] = [];
  let duration = 0;

  // Per-frame view state
  let t = 0;
  let cueIndex = 0;
  let lineIndex = 0;
  let shown = 0;

  // Timeline pointer state
  let scrubEl: HTMLElement;
  let hoverT: number | null = null;
  let dragT: number | null = null;

  let raf = 0;
  let lastY = -1;
  let lastCue = -1;
  let reduce = false;
  let seekTimer = 0;
  let seekResume = false;
  let panelTouched = 0;
  /** Said with the next "Playing" (e.g. the section a seek landed on). */
  let pendingNote = '';

  // Voice ring
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freq: Uint8Array | null = null;
  const RING_POINTS = 48;

  $: lineWords = lines.length ? words.slice(lines[lineIndex], lineIndex + 1 < lines.length ? lines[lineIndex + 1] : words.length) : [];
  $: lineFirst = lines.length ? lines[lineIndex] : 0;
  $: shownT = dragT ?? t;
  $: progress = duration ? Math.min(1, shownT / duration) : 0;
  $: about = aboutMinutes(duration || 108);
  $: minutes = Math.max(1, Math.round((duration || 108) / 60));
  $: playing = status === 'playing';
  $: cue = cues[cueIndex] ?? cues[0];
  $: hoverCue = hoverT === null ? null : cues[cueAt(starts, hoverT)];
  $: valueText = `${spokenTime(shownT)} of ${spokenTime(duration)}, ${cues[cueAt(starts, shownT)]?.label ?? ''}`;

  function store(key: string, value?: string): string | null {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
    return null;
  }

  function savePrefs() {
    store(PREFS_KEY, JSON.stringify({ rate, captionsOn }));
  }

  /** Polite live-region message; re-announces the same text too. */
  async function announce(msg: string) {
    announcement = '';
    await tick();
    announcement = msg;
  }

  /** Phones, scrolled past the first screen: the launcher shows its disc only. */
  let compact = false;

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const p = JSON.parse(store(PREFS_KEY) || '{}');
      if (typeof p.rate === 'number') rate = p.rate;
      if (typeof p.captionsOn === 'boolean') captionsOn = p.captionsOn;
    } catch {
      /* ignore bad prefs */
    }
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
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
      }
      pause(true);
    };
    window.addEventListener('wheel', intent, { passive: true });
    window.addEventListener('touchmove', intent, { passive: true });
    window.addEventListener('keydown', intent);
    // Phones: past the first screen the launcher shrinks to its disc so it
    // covers less of the page; the full label returns at the top.
    const phone = window.matchMedia('(max-width: 767px)');
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compact = phone.matches && window.scrollY > window.innerHeight * 0.8;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    phone.addEventListener?.('change', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      phone.removeEventListener?.('change', onScroll);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      ro.disconnect();
      window.removeEventListener('wheel', intent);
      window.removeEventListener('touchmove', intent);
      window.removeEventListener('keydown', intent);
    };
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    cancelAnimationFrame(raf);
    window.clearTimeout(seekTimer);
    ctx?.close().catch(() => {});
    mediaSession(false);
    document.documentElement.style.removeProperty('--narrator-reserve');
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
      sections = transcriptSections(cues, words, starts);
      status = 'ready';
      await tick();
      measure();
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const robot = (navigator as Navigator & { webdriver?: boolean }).webdriver;
      if (wide && !robot && !store(OFFER_KEY)) offer = true;
    } catch {
      status = 'error';
    }
  }

  function measure() {
    if (!starts.length) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    // Space the bar takes at the bottom of the screen (its height plus its offset), ignoring its entrance transform.
    const reserve = barOpen && bar ? bar.offsetHeight + (parseFloat(getComputedStyle(bar).bottom) || 0) + 12 : 0;
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
    store(OFFER_KEY, 'played');
    barOpen = true;
    pausedByScroll = false;
    audioError = false;
    setupWave();
    mediaSession(true);
    await ctx?.resume().catch(() => {});
    await tick();
    // The launcher or dialog that started us is gone: keep focus in the player.
    playBtn?.focus({ preventScroll: true });
    measure();
    audio.playbackRate = rate;
    audio.currentTime = from;
    t = from;
    lastCue = -1;
    await glideTo(followY(ranges, starts, ends, from));
    play();
  }

  function play() {
    pausedByScroll = false;
    audio.playbackRate = rate;
    audio.play().then(
      () => {
        const was = status;
        status = 'playing';
        if (pendingNote) announce(was !== 'playing' ? `${pendingNote}. Playing` : pendingNote);
        else if (was !== 'playing') announce('Playing');
        pendingNote = '';
        loop();
      },
      () => {
        status = 'paused';
      }
    );
  }

  function pause(byScroll = false) {
    seekResume = false;
    audio?.pause();
    status = 'paused';
    pausedByScroll = byScroll;
    cancelAnimationFrame(raf);
    draw(true);
    announce(byScroll ? 'Paused because you scrolled. Use Resume to continue.' : 'Paused');
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

  /**
   * Moves to `target` seconds. Repeated calls (holding an arrow key) only
   * move the captions; the page glides once the visitor stops. Playback
   * continues if it was playing, or starts when `andPlay` is set.
   */
  function seekTo(target: number, andPlay = false) {
    if (!duration) return;
    const time = Math.max(0, Math.min(duration - 0.05, target));
    if (!seekTimer) seekResume = status === 'playing';
    seekResume = seekResume || andPlay;
    audio.pause();
    cancelAnimationFrame(raf);
    pausedByScroll = false;
    audio.currentTime = time;
    update(time);
    draw(true);
    window.clearTimeout(seekTimer);
    seekTimer = window.setTimeout(async () => {
      seekTimer = 0;
      lastCue = cueAt(starts, time);
      await glideTo(followY(ranges, starts, ends, time));
      if (seekResume) play();
      else if (status !== 'paused') status = 'paused';
      seekResume = false;
    }, 220);
  }

  function seekCue(i: number) {
    const k = Math.max(0, Math.min(cues.length - 1, i));
    pendingNote = `Section ${k + 1} of ${cues.length}: ${cues[k].label}`;
    seekTo(starts[k] + 0.01, true);
  }

  function setRate() {
    rate = nextRate(rate);
    if (audio) audio.playbackRate = rate;
    savePrefs();
    announce(`Speed ${rate}×`);
  }

  function toggleMute() {
    muted = !muted;
    announce(muted ? 'Muted' : 'Sound on');
  }

  function toggleCaptions() {
    captionsOn = !captionsOn;
    savePrefs();
    announce(captionsOn ? 'Captions on' : 'Captions off');
  }

  async function toggleTranscript(open = !transcriptOpen) {
    transcriptOpen = open;
    if (open) {
      await tick();
      scrollTranscript(true);
      transcriptList?.querySelector<HTMLElement>('[aria-current] .tr-jump')?.focus({ preventScroll: true });
    } else {
      transcriptBtn?.focus({ preventScroll: true });
    }
  }

  async function exit() {
    audio.pause();
    cancelAnimationFrame(raf);
    window.clearTimeout(seekTimer);
    seekTimer = 0;
    status = 'ready';
    barOpen = false;
    transcriptOpen = false;
    pausedByScroll = false;
    mediaSession(false);
    document.documentElement.style.setProperty('--narrator-reserve', '0px');
    announce('Narration closed');
    await tick();
    launcherBtn?.focus({ preventScroll: true });
  }

  function decline() {
    offer = false;
    store(OFFER_KEY, 'declined');
  }

  function onAudioError() {
    audioError = true;
    buffering = false;
    cancelAnimationFrame(raf);
    if (barOpen) {
      status = 'paused';
      announce("The audio couldn't load. The transcript has everything Pablo says.");
    }
  }

  async function onEnded() {
    cancelAnimationFrame(raf);
    status = 'ended';
    draw(true);
    announce("That's the end of the tour. Taking you back to the booking form.");
    // Back to the booking form the narration started on: a short cut, not a long scroll.
    const el = document.getElementById(endAnchor);
    if (!el) return;
    if (endAnchor === 'hero-form') await jumpToBooking();
    else {
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY), behavior: 'instant' as ScrollBehavior });
      openBooking(el);
    }
  }

  /** Lock-screen, headset and media-key controls. */
  function mediaSession(on: boolean) {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    };
    if (on) {
      try {
        ms.metadata = new MediaMetadata({ title: 'How we plan your move', artist: 'Pablo Arias, founder', album: 'International Relocation Partner' });
      } catch {
        /* no MediaMetadata */
      }
    } else ms.metadata = null;
    set('play', on ? () => resume() : null);
    set('pause', on ? () => pause() : null);
    set('seekbackward', on ? () => seekTo(audio.currentTime - JUMP) : null);
    set('seekforward', on ? () => seekTo(audio.currentTime + JUMP) : null);
    set('previoustrack', on ? () => seekCue(cueIndex - 1) : null);
    set('nexttrack', on ? () => seekCue(cueIndex + 1) : null);
  }

  /* ── Keyboard ─────────────────────────────────────────────── */

  /** Shortcuts, only while focus is inside the player. */
  function onBarKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (transcriptOpen) {
        e.preventDefault();
        toggleTranscript(false);
      } else tipsHidden = true;
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const act: Record<string, () => void> = {
      k: toggle,
      j: () => seekTo(audio.currentTime - JUMP),
      l: () => seekTo(audio.currentTime + JUMP),
      m: toggleMute,
      c: toggleCaptions,
      t: () => toggleTranscript()
    };
    if (act[key]) {
      e.preventDefault();
      act[key]();
    }
  }

  function onSliderKey(e: KeyboardEvent) {
    const now = audio.currentTime;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => seekTo(now - STEP),
      ArrowDown: () => seekTo(now - STEP),
      ArrowRight: () => seekTo(now + STEP),
      ArrowUp: () => seekTo(now + STEP),
      PageDown: () => seekCue(cueIndex - 1),
      PageUp: () => seekCue(cueIndex + 1),
      Home: () => seekTo(0),
      End: () => seekTo(duration),
      ' ': toggle,
      Enter: toggle
    };
    if (keys[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keys[e.key]();
    }
  }

  /* ── Timeline pointer ─────────────────────────────────────── */

  function timeAt(e: PointerEvent) {
    const r = scrubEl.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration;
  }
  function scrubDown(e: PointerEvent) {
    if (e.button !== 0) return;
    scrubEl.setPointerCapture(e.pointerId);
    dragT = timeAt(e);
  }
  function scrubMove(e: PointerEvent) {
    hoverT = timeAt(e);
    if (dragT !== null) dragT = hoverT;
  }
  function scrubUp(e: PointerEvent) {
    if (dragT === null) return;
    const to = timeAt(e);
    dragT = null;
    if (scrubEl.hasPointerCapture(e.pointerId)) scrubEl.releasePointerCapture(e.pointerId);
    seekTo(to);
  }
  function scrubLeave() {
    if (dragT === null) hoverT = null;
  }

  /* ── Frame loop ───────────────────────────────────────────── */

  function update(time: number) {
    t = time;
    const c = cueAt(starts, time);
    if (c !== cueIndex) {
      cueIndex = c;
      if (transcriptOpen) scrollTranscript(false);
    }
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
    lastY = y;
    window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
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
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo({ top: from + d * e, behavior: 'instant' as ScrollBehavior });
        if (p < 1) requestAnimationFrame(step);
        else {
          lastY = y;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** Keeps the current section in view inside the transcript panel (not the page). */
  function scrollTranscript(force: boolean) {
    if (!transcriptList) return;
    if (!force && performance.now() - panelTouched < 4000) return; // the visitor is reading elsewhere
    const li = transcriptList.querySelector<HTMLElement>('[aria-current]');
    if (!li) return;
    transcriptList.scrollTo({ top: li.offsetTop - 8, behavior: reduce || force ? 'auto' : 'smooth' });
  }

  /* ── Voice ring ───────────────────────────────────────────── */

  function draw(idle: boolean) {
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (analyser && freq && !idle) analyser.getByteFrequencyData(freq);
    const cx = w / 2;
    const cy = h / 2;
    const r0 = Math.min(w, h) / 2 - 8; // just outside the 48px button
    const now = performance.now();
    // A soft closed wave around the button: its radius follows the voice
    // spectrum, mirrored left/right; idle it is a quiet circle.
    const pts: [number, number][] = [];
    for (let k = 0; k < RING_POINTS; k++) {
      const f = k / RING_POINTS;
      const u = f < 0.5 ? f * 2 : (1 - f) * 2; // 0 at top, 1 at bottom, mirrored
      let level = 0;
      if (!idle) {
        if (analyser && freq) {
          const x = 1 + u * 13;
          const i0 = Math.floor(x);
          level = ((freq[i0] ?? 0) * (1 - (x - i0)) + (freq[i0 + 1] ?? 0) * (x - i0)) / 255;
        } else level = 0.35 + 0.3 * Math.sin(now / 170 + u * 6);
      }
      const r = r0 + level * 7;
      const a = f * Math.PI * 2 - Math.PI / 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    g.beginPath();
    const mid = (i: number) => {
      const p = pts[i % pts.length];
      const q = pts[(i + 1) % pts.length];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    const m0 = mid(0);
    g.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length];
      const m = mid(i);
      g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    g.closePath();
    g.fillStyle = idle ? 'rgba(2,181,187,0.08)' : 'rgba(2,181,187,0.2)';
    g.fill();
    g.strokeStyle = idle ? 'rgba(2,181,187,0.35)' : 'rgba(2,181,187,0.9)';
    g.lineWidth = 1.5;
    g.stroke();
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

  /* ── Offer dialog ─────────────────────────────────────────── */

  /**
   * Focuses the play button, traps Tab, closes on Escape, makes everything
   * outside the dialog inert, and gives focus back on close.
   */
  function dialog(node: HTMLElement) {
    const prev = document.activeElement as HTMLElement | null;
    const inerted: Element[] = [];
    let el: Element | null = node.parentElement; // the backdrop
    while (el && el !== document.body) {
      const parent: HTMLElement | null = el.parentElement;
      if (!parent) break;
      for (const sib of Array.from(parent.children)) {
        if (sib !== el && !sib.hasAttribute('inert') && !/^(SCRIPT|STYLE|AUDIO)$/.test(sib.tagName)) {
          sib.setAttribute('inert', '');
          inerted.push(sib);
        }
      }
      el = parent;
    }
    node.querySelector<HTMLElement>('.offer-play')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        decline();
      } else if (e.key === 'Tab') {
        const f = Array.from(node.querySelectorAll<HTMLElement>('button'));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    node.addEventListener('keydown', onKey);
    return {
      destroy() {
        node.removeEventListener('keydown', onKey);
        inerted.forEach((s) => s.removeAttribute('inert'));
        // Starting the tour moves focus into the player; declining returns it.
        if (!barOpen) prev?.focus?.({ preventScroll: true });
      }
    };
  }
</script>

<audio
  bind:this={audio}
  src={audioSrc}
  preload="metadata"
  {muted}
  on:ended={onEnded}
  on:waiting={() => (buffering = true)}
  on:stalled={() => (buffering = status === 'playing')}
  on:playing={() => (buffering = false)}
  on:canplay={() => (buffering = false)}
  on:error={onAudioError}
></audio>

<div class="mask" class:on={masking} aria-hidden="true"></div>

<!-- Announcements for screen readers (state changes only, never the captions). -->
<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

{#if offer}
  <!-- Clicking the backdrop is a pointer shortcut for "Read the page instead"; Escape does the same. -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="offer-backdrop" on:click|self={decline}>
    <div class="offer" role="dialog" aria-modal="true" aria-labelledby="narrator-offer-title" aria-describedby="narrator-offer-desc" use:dialog>
      <div class="offer-wave" aria-hidden="true">
        {#each Array(21) as _, i}<i style="--i:{i}; --h:{(0.25 + 0.75 * Math.abs(Math.sin(i * 1.7))).toFixed(2)}"></i>{/each}
      </div>
      <p class="offer-eyebrow">A narrated tour · {minutes} min</p>
      <h2 id="narrator-offer-title">Let Pablo walk you through it.</h2>
      <p class="offer-sub" id="narrator-offer-desc">
        The founder explains how we plan your move, {about}. Captions and a transcript are included, and scrolling pauses the voice.
      </p>
      <div class="offer-actions">
        <button class="offer-play" on:click={() => start(0)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" /></svg>
          Play the narrated tour
        </button>
        <button class="offer-read" on:click={decline}>Read the page instead</button>
      </div>
      <p class="offer-note" aria-hidden="true"><kbd>Esc</kbd> to close</p>
    </div>
  </div>
{/if}

{#if !barOpen && status !== 'loading' && status !== 'error'}
  <button class="launcher" class:compact bind:this={launcherBtn} on:click={() => start(0)} in:fly={{ y: 12, duration: reduce ? 0 : 320 }}>
    <span class="launcher-disc" aria-hidden="true">
      <span class="launcher-wave"><i></i><i></i><i></i><i></i></span>
      <svg class="launcher-play" viewBox="0 0 16 16"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" /></svg>
    </span>
    <span class="launcher-text">Listen to Pablo<span class="sr-only">: a narrated tour of this page, {about}</span></span>
    <span class="launcher-time" aria-hidden="true">{minutes} min</span>
  </button>
{/if}

{#if barOpen}
  <!-- The keydown here only delegates shortcuts for the controls inside the player. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    class="bar"
    class:playing
    class:buffering
    class:tips-off={tipsHidden}
    bind:this={bar}
    aria-label="Narrated tour"
    aria-busy={buffering}
    on:keydown={onBarKey}
    on:pointermove={() => (tipsHidden = false)}
    on:focusin={() => (tipsHidden = false)}
    transition:fly={{ y: 28, duration: reduce ? 0 : 380, opacity: 0 }}
  >
    {#if transcriptOpen}
      <div class="transcript" id="narrator-transcript" role="region" aria-labelledby="narrator-transcript-title" transition:fly={{ y: 12, duration: reduce ? 0 : 260 }}>
        <div class="tr-head">
          <h2 id="narrator-transcript-title">Transcript</h2>
          <button class="tr-close tip-end" on:click={() => toggleTranscript(false)} aria-label="Close transcript" data-tip="Close (Esc)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <ol class="tr-list" bind:this={transcriptList} on:wheel={() => (panelTouched = performance.now())} on:touchmove={() => (panelTouched = performance.now())}>
          {#each sections as s, i}
            <li class:current={i === cueIndex} aria-current={i === cueIndex ? 'step' : undefined}>
              <button class="tr-jump" on:click={() => seekCue(i)}>
                <span class="tr-time">{formatTime(s.start)}</span>
                <span class="tr-label">{s.label}</span>
                <span class="sr-only">, play from here</span>
                <svg class="tr-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" /></svg>
              </button>
              <p>
                {#if i === cueIndex}
                  {#each words.slice(s.first, s.last) as w, j}<span class:said={s.first + j < shown}>{w.word}</span>{' '}{/each}
                {:else}
                  {words.slice(s.first, s.last).map((w) => w.word).join(' ')}
                {/if}
              </p>
            </li>
          {/each}
        </ol>
        <div class="tr-keys">
          <h3>Keyboard shortcuts in the player</h3>
          <dl>
            <div><dt><kbd>K</kbd></dt><dd>Play or pause</dd></div>
            <div><dt><kbd>J</kbd> <kbd>L</kbd></dt><dd>Back or forward 10 s</dd></div>
            <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>5 s on the timeline</dd></div>
            <div><dt><kbd>PgUp</kbd> <kbd>PgDn</kbd></dt><dd>Section on the timeline</dd></div>
            <div><dt><kbd>M</kbd></dt><dd>Mute</dd></div>
            <div><dt><kbd>C</kbd></dt><dd>Captions</dd></div>
            <div><dt><kbd>T</kbd></dt><dd>Transcript</dd></div>
          </dl>
        </div>
      </div>
    {/if}

    <!-- Timeline: a slider with one tick per section. -->
    <div
      class="scrub"
      class:dragging={dragT !== null}
      bind:this={scrubEl}
      role="slider"
      tabindex="0"
      aria-label="Narration timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shownT)}
      aria-valuetext={valueText}
      on:keydown={onSliderKey}
      on:pointerdown={scrubDown}
      on:pointermove={scrubMove}
      on:pointerup={scrubUp}
      on:pointercancel={scrubUp}
      on:pointerleave={scrubLeave}
    >
      <span class="scrub-track" aria-hidden="true">
        <span class="scrub-fill" style="transform: scaleX({progress})"></span>
        {#if hoverT !== null && dragT === null}
          <span class="scrub-ghost" style="transform: scaleX({duration ? hoverT / duration : 0})"></span>
        {/if}
        {#each starts as s, i}
          {#if i > 0 && duration}<span class="tick" class:done={shownT >= s} style="left: {(s / duration) * 100}%"></span>{/if}
        {/each}
      </span>
      <span class="scrub-thumb" aria-hidden="true" style="left: {progress * 100}%"></span>
      {#if hoverT !== null && hoverCue}
        <span class="scrub-tip" aria-hidden="true" style="left: clamp(70px, {(hoverT / duration) * 100}%, calc(100% - 70px))">
          <b>{hoverCue.label}</b>{formatTime(hoverT)}
        </span>
      {/if}
    </div>

    <div class="row">
      <div class="play-wrap">
        <canvas bind:this={canvas} aria-hidden="true"></canvas>
        <button
          class="play"
          bind:this={playBtn}
          on:click={toggle}
          aria-label={playing ? 'Pause' : status === 'ended' ? 'Replay' : 'Play'}
          aria-keyshortcuts="K"
          data-tip={playing ? 'Pause (K)' : status === 'ended' ? 'Replay' : 'Play (K)'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <g class="i-pause"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" /></g>
            <path class="i-play" d="M8 5.6v12.8a.9.9 0 0 0 1.4.8l10-6.4a.9.9 0 0 0 0-1.6l-10-6.4A.9.9 0 0 0 8 5.6z" />
          </svg>
          <span class="spinner" aria-hidden="true"></span>
        </button>
      </div>

      <div class="middle">
        {#if audioError}
          <div class="notice">
            <span>The audio couldn't load.</span>
            <button class="pill" on:click={() => toggleTranscript(true)}>Read the transcript</button>
          </div>
        {:else if status === 'ended'}
          <div class="notice">
            <span>That's the tour. You're back at the booking form.</span>
            <button class="pill" on:click={() => start(0)}>Replay</button>
          </div>
        {:else if pausedByScroll}
          <div class="notice">
            <span>Paused while you scroll.</span>
            <button class="pill" on:click={resume}>Resume</button>
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
          <p class="section-only">{cue.label}</p>
        {/if}
        <p class="meta">
          <span class="meta-n" aria-hidden="true">{pad(cueIndex + 1)}/{pad(cues.length)}</span>
          <span class="sr-only">Section {cueIndex + 1} of {cues.length}:</span>
          {#key cueIndex}<span class="meta-label" in:fly={{ y: 6, duration: reduce ? 0 : 260 }}>{cue.label}</span>{/key}
          <span class="meta-time" aria-hidden="true">{formatTime(shownT)} <i>/</i> {formatTime(duration)}</span>
        </p>
      </div>

      <div class="controls" role="group" aria-label="Narration controls">
        <button class="ctl prev" on:click={() => seekCue(cueIndex - 1)} aria-label="Previous section" data-tip="Previous section" disabled={cueIndex === 0}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
        </button>
        <button class="ctl next" on:click={() => seekCue(cueIndex + 1)} aria-label="Next section" data-tip="Next section" disabled={cueIndex === cues.length - 1}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
        </button>
        <span class="sep" aria-hidden="true"></span>
        <button class="ctl rate" on:click={setRate} aria-label="Playback speed {rate}×" data-tip="Speed">
          {#key rate}<span in:fly={{ y: 8, duration: reduce ? 0 : 200 }}>{rate}×</span>{/key}
        </button>
        <button class="ctl cc" on:click={toggleCaptions} aria-label="Captions" aria-pressed={captionsOn} aria-keyshortcuts="C" data-tip="Captions (C)">
          <svg viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2" width="17" height="12" rx="2.5" /><path d="M8.6 6.4a2 2 0 1 0 0 3.2M14.4 6.4a2 2 0 1 0 0 3.2" /></svg>
        </button>
        <button
          class="ctl tr"
          bind:this={transcriptBtn}
          on:click={() => toggleTranscript()}
          aria-label="Transcript"
          aria-expanded={transcriptOpen}
          aria-controls="narrator-transcript"
          aria-keyshortcuts="T"
          data-tip="Transcript (T)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" /></svg>
        </button>
        <button class="ctl mute" on:click={toggleMute} aria-label="Mute" aria-pressed={muted} aria-keyshortcuts="M" data-tip={muted ? 'Unmute (M)' : 'Mute (M)'}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path class="spk" d="M2.5 6h2.2L8 3.3v9.4L4.7 10H2.5z" />
            {#if muted}<path d="M10.5 6l4 4M14.5 6l-4 4" />{:else}<path class="waves" d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.3 3.8a6 6 0 0 1 0 8.4" />{/if}
          </svg>
        </button>
        <button class="ctl exit tip-end" on:click={exit} aria-label="Close narration" data-tip="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  </section>
{/if}

<style lang="scss">
  @use '../landing/tokens' as *;

  $bar-bg: rgba(10, 36, 42, 0.94);
  $line: rgba(255, 255, 255, 0.16);

  .sr-only {
    position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  .mask {
    position: fixed; inset: 0; z-index: 90; pointer-events: none;
    background: $color-canvas; opacity: 0;
    transition: opacity 130ms cubic-bezier(0.4, 0, 1, 1);
    &.on { opacity: 1; transition-duration: 110ms; }
  }

  svg { display: block; }
  /* Beat the global `svg, path { fill }` rule (SVG.scss): paths take the icon's fill. */
  path, rect { fill: inherit; }
  kbd {
    font-family: $font-mono; font-size: 0.7rem; line-height: 1; padding: 3px 6px; border-radius: 5px;
    border: 1px solid $line; border-bottom-width: 2px; color: $color-on-dark; background: rgba(255, 255, 255, 0.06);
  }

  /* ── Offer ── */
  .offer-backdrop {
    position: fixed; inset: 0; z-index: 20000; // above the header and chat bubble; page is inert meanwhile
    display: grid; place-items: center; padding: 1rem;
    background: rgba(8, 28, 33, 0.6);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    animation: fade 400ms $ease both;
  }
  .offer {
    position: relative; overflow: hidden;
    width: min(540px, 100%);
    background: radial-gradient(120% 90% at 50% 0%, #15444d 0%, $color-ink-strong 60%);
    color: $color-on-dark;
    border: 1px solid $line; border-radius: 24px;
    padding: 2.5rem 2.5rem 1.75rem; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 0.9rem;
    box-shadow: 0 40px 90px -24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    animation: rise 600ms $ease both;
    h2 { font-family: $font-sans; font-weight: 700; font-size: clamp(1.6rem, 3vw, 2.1rem); letter-spacing: -0.03em; line-height: 1.1; margin: 0; color: $color-on-dark; }
  }
  .offer-wave {
    display: flex; align-items: center; justify-content: center; gap: 4px; height: 44px; margin-bottom: 0.25rem;
    i {
      width: 4px; border-radius: 3px; background: $color-accent;
      height: calc(10px + 30px * var(--h, 0.5));
      animation: talk 1.6s ease-in-out infinite;
      animation-delay: calc(var(--i) * -0.13s);
    }
  }
  .offer-eyebrow { @include eyebrow; color: $color-accent; }
  .offer-sub { font-family: $font-sans; color: $color-on-dark-muted; margin: 0 0 0.4rem; line-height: 1.55; max-width: 40ch; }
  .offer-actions { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
  .offer-play {
    @include button-primary;
    & { padding-inline: 1.9rem; box-shadow: 0 10px 30px -10px rgba(2, 181, 187, 0.7); }
    svg { width: 14px; height: 14px; fill: currentColor; }
  }
  .offer-read {
    min-height: $touch-target; padding: 0 1rem;
    background: none; border: none; cursor: pointer; color: $color-on-dark-muted; border-radius: $radius-pill;
    font-family: $font-sans; font-size: 0.92rem; text-decoration: underline; text-underline-offset: 3px;
    &:hover { color: $color-on-dark; }
    @include focus-ring;
  }
  .offer-note { margin: 0.2rem 0 0; font-family: $font-sans; font-size: 0.75rem; color: $color-on-dark-muted; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(16px) scale(0.98); } }
  @keyframes talk { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }

  /* ── Launcher ── */
  .launcher {
    position: fixed; left: 1rem; bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 80;
    display: inline-flex; align-items: center; gap: 0.65rem;
    min-height: 48px; padding: 0.35rem 0.5rem 0.35rem 0.35rem; border-radius: $radius-pill;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: $color-ink-strong; color: $color-on-dark;
    font-family: $font-sans; font-weight: 600; font-size: 0.92rem; cursor: pointer;
    box-shadow: 0 14px 34px -12px rgba(14, 47, 54, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: transform 240ms $ease, box-shadow 240ms $ease;
    @include focus-ring;
    &:hover { transform: translateY(-2px); box-shadow: 0 18px 40px -12px rgba(14, 47, 54, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08); }
    &:active { transform: scale(0.97); }
  }
  .launcher-text {
    font-family: $font-sans; white-space: nowrap; overflow: hidden; max-width: 12rem;
    transition: max-width 320ms $ease, opacity 220ms $ease;
  }
  /* Disc only; the label stays in the accessibility tree (clipped, not removed). */
  .launcher.compact { gap: 0; padding: 0.35rem; }
  .launcher.compact .launcher-text { max-width: 0; opacity: 0; }
  .launcher-disc {
    position: relative; width: 38px; height: 38px; border-radius: 50%; background: $color-accent;
    display: grid; place-items: center; color: $color-ink-strong; flex: none;
    &::after {
      content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid $color-accent;
      opacity: 0; animation: halo 2.8s $ease infinite;
    }
  }
  .launcher-wave, .launcher-play { grid-area: 1 / 1; transition: opacity 200ms, transform 300ms $ease; }
  .launcher-wave {
    display: inline-flex; align-items: center; gap: 2px; height: 16px;
    i { width: 3px; border-radius: 2px; background: $color-ink-strong; animation: idle 1.4s ease-in-out infinite; }
    i:nth-child(1) { height: 40%; }
    i:nth-child(2) { height: 90%; animation-delay: 0.15s; }
    i:nth-child(3) { height: 60%; animation-delay: 0.3s; }
    i:nth-child(4) { height: 80%; animation-delay: 0.45s; }
  }
  .launcher-play { width: 15px; height: 15px; fill: currentColor; opacity: 0; transform: scale(0.6); margin-left: 2px; }
  .launcher:hover, .launcher:focus-visible {
    .launcher-wave { opacity: 0; transform: scale(0.6); }
    .launcher-play { opacity: 1; transform: none; }
  }
  .launcher-time {
    font-family: $font-mono; font-size: 0.68rem; letter-spacing: 0.06em; color: $color-on-dark-muted;
    padding: 4px 8px; border-radius: $radius-pill; border: 1px solid $line;
  }
  @keyframes idle { 50% { transform: scaleY(0.45); } }
  @keyframes halo { 0% { opacity: 0.6; transform: scale(0.9); } 70%, 100% { opacity: 0; transform: scale(1.35); } }

  /* ── Player bar ── */
  .bar {
    position: fixed; z-index: 100; left: 0; right: 0; bottom: max(1rem, env(safe-area-inset-bottom));
    margin: 0 auto; width: min(900px, calc(100vw - 176px)); // clears the chat bubble on both sides
    display: flex; flex-direction: column;
    background: $bar-bg; color: $color-on-dark;
    backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%);
    border: 1px solid $line; border-radius: 20px;
    box-shadow: 0 28px 70px -24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .bar { background: $color-ink-strong; }
  }

  /* Timeline: 4px line, 24px hit area. */
  .scrub {
    position: relative; height: 24px; margin: 0 16px; cursor: pointer; touch-action: none;
    border-radius: 6px; outline: none;
    &:focus-visible { box-shadow: 0 0 0 2px $color-accent; }
  }
  .scrub-track {
    position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; border-radius: 4px;
    background: rgba(255, 255, 255, 0.18);
    transition: height 160ms $ease, margin 160ms $ease;
  }
  .scrub:hover .scrub-track, .scrub:focus-visible .scrub-track, .scrub.dragging .scrub-track { height: 6px; margin-top: -3px; }
  .scrub-fill, .scrub-ghost {
    position: absolute; inset: 0; border-radius: inherit; transform-origin: left;
  }
  .scrub-fill { background: $color-accent; }
  .scrub-ghost { background: rgba(255, 255, 255, 0.22); }
  .tick {
    position: absolute; top: -1px; bottom: -1px; width: 2px; margin-left: -1px; border-radius: 1px;
    background: $bar-bg; // a gap in the line marks each section
  }
  .scrub-thumb {
    position: absolute; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
    background: #fff; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4);
    transform: scale(0); transition: transform 180ms $ease;
  }
  .scrub:hover .scrub-thumb, .scrub:focus-visible .scrub-thumb, .scrub.dragging .scrub-thumb { transform: scale(1); }
  .scrub-tip {
    position: absolute; bottom: calc(100% + 6px); transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 1px; white-space: nowrap; pointer-events: none;
    padding: 6px 10px; border-radius: 9px; background: #fff; color: $color-ink-strong;
    font: 600 0.72rem/1.2 $font-mono; box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.45);
    b { font: 700 0.8rem/1.2 $font-sans; }
  }

  .row {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem;
    padding: 2px 14px 12px 10px;
  }

  /* Play/pause with the voice ring around it. */
  .play-wrap { position: relative; width: 72px; height: 72px; display: grid; place-items: center; flex: none; }
  .play-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .play {
    position: relative; width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
    display: grid; place-items: center; background: $color-accent; color: $color-ink-strong;
    box-shadow: 0 8px 22px -8px rgba(2, 181, 187, 0.8);
    transition: transform 180ms $ease, background 200ms;
    &:hover { background: $color-accent-hover; transform: scale(1.04); }
    &:active { transform: scale(0.94); }
    @include focus-ring;
    svg { width: 22px; height: 22px; fill: currentColor; overflow: visible; }
    .i-pause, .i-play { transform-origin: 12px 12px; transition: transform 260ms $ease, opacity 180ms; }
    .i-pause { opacity: 0; transform: scale(0.4) rotate(-90deg); }
  }
  .bar.playing .play {
    .i-pause { opacity: 1; transform: none; }
    .i-play { opacity: 0; transform: scale(0.4) rotate(90deg); }
  }
  .spinner {
    position: absolute; inset: -5px; border-radius: 50%; border: 2px solid transparent; border-top-color: #fff;
    opacity: 0; transition: opacity 200ms;
  }
  .bar.buffering .spinner { opacity: 1; animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .middle { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .caption {
    margin: 0; font-family: $font-sans; font-weight: 600; letter-spacing: -0.01em;
    font-size: clamp(1rem, 1.55vw, 1.22rem); line-height: 1.35; min-height: 1.35em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .w { display: inline-block; font-family: $font-sans; transition: opacity 160ms ease, transform 220ms $ease; }
  .w.next { opacity: 0; transform: translateY(6px); }
  .w.past { color: $color-on-dark; }
  .w.now {
    --p: 0;
    background: linear-gradient(90deg, $color-accent calc(var(--p) * 100%), rgba(255, 255, 255, 0.55) calc(var(--p) * 100%));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .section-only { margin: 0; font-family: $font-sans; font-weight: 600; font-size: 1.05rem; }
  .meta {
    margin: 0; display: flex; align-items: baseline; gap: 0.6rem; min-width: 0;
    font-family: $font-mono; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: $color-on-dark-muted;
    span { font-family: $font-mono; }
  }
  .meta-n { color: $color-accent; }
  .meta-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .meta-time { margin-left: auto; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; white-space: nowrap; i { font-style: normal; opacity: 0.6; } }
  .notice {
    display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; color: $color-on-dark-muted; min-height: 1.65rem;
    span { font-family: $font-sans; font-size: 0.95rem; }
  }
  .pill {
    position: relative; min-height: 32px; padding: 0.3rem 0.95rem; border-radius: $radius-pill; border: none; cursor: pointer;
    background: $color-accent; color: $color-ink-strong; font: 700 0.85rem $font-sans;
    transition: background 200ms, transform 160ms $ease;
    &:hover { background: $color-accent-hover; }
    &:active { transform: scale(0.96); }
    @include focus-ring;
    // 32px visual, 44px touch target
    &::before { content: ''; position: absolute; inset: -6px 0; }
  }

  .controls { display: flex; align-items: center; gap: 2px; }
  .sep { width: 1px; height: 20px; background: $line; margin: 0 6px; }
  .ctl {
    position: relative; width: 40px; height: 40px; border-radius: 12px; border: none; cursor: pointer;
    display: grid; place-items: center; background: transparent; color: $color-on-dark;
    transition: background 180ms, color 180ms, transform 160ms $ease;
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.09); }
    &:active:not(:disabled) { transform: scale(0.92); }
    &:disabled { color: rgba(255, 255, 255, 0.32); cursor: not-allowed; }
    @include focus-ring;
    // Pressed toggles: tinted, plus a dot (not colour alone).
    &[aria-pressed='true'], &[aria-expanded='true'] {
      background: rgba(2, 181, 187, 0.18); color: #7fe3e6;
      &::before { content: ''; position: absolute; bottom: 4px; left: 50%; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: currentColor; }
    }
  }
  .prev:hover:not(:disabled) svg { transform: translateX(-2px); }
  .next:hover:not(:disabled) svg { transform: translateX(2px); }
  .prev svg, .next svg { transition: transform 200ms $ease; }
  .mute .spk { fill: currentColor; }
  .rate { width: 48px; overflow: hidden; font: 700 0.8rem $font-mono; font-variant-numeric: tabular-nums; span { font-family: $font-mono; } }

  /* Tooltips for icon buttons: hover or keyboard focus, Escape hides them (WCAG 1.4.13). */
  [data-tip]::after {
    content: attr(data-tip); position: absolute; bottom: calc(100% + 10px); left: 50%;
    transform: translate(-50%, 4px); opacity: 0; pointer-events: none; white-space: nowrap;
    padding: 6px 9px; border-radius: 8px; background: #fff; color: $color-ink-strong;
    font: 600 0.75rem/1 $font-sans; box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.45);
    transition: opacity 140ms, transform 200ms $ease; transition-delay: 0ms;
  }
  @include hover-only {
    [data-tip]:hover::after { opacity: 1; transform: translate(-50%, 0); transition-delay: 350ms; pointer-events: auto; }
  }
  [data-tip]:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
  .tips-off [data-tip]::after { opacity: 0 !important; }
  /* Right-aligned tips for the last button in a row. */
  .tip-end::after { left: auto; right: 0; transform: translate(0, 4px); }
  @include hover-only { .tip-end:hover::after { transform: none; } }
  .tip-end:focus-visible::after { transform: none; }

  /* ── Transcript ── */
  .transcript {
    position: absolute; left: 0; right: 0; bottom: calc(100% + 10px);
    display: flex; flex-direction: column; max-height: min(56vh, 520px);
    background: $color-ink-strong; color: $color-on-dark;
    border: 1px solid $line; border-radius: 20px; overflow: hidden;
    box-shadow: 0 28px 70px -24px rgba(0, 0, 0, 0.6);
  }
  .tr-head {
    display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 10px 20px; border-bottom: 1px solid $line;
    h2 { margin: 0; font: 700 1rem $font-sans; color: $color-on-dark; }
  }
  .tr-close {
    position: relative; width: 40px; height: 40px; border-radius: 12px; border: none; background: transparent; color: $color-on-dark; cursor: pointer;
    display: grid; place-items: center;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; fill: none; }
    &:hover { background: rgba(255, 255, 255, 0.09); }
    @include focus-ring;
    &::after { bottom: auto; top: calc(100% + 6px); }
  }
  .tr-list {
    position: relative; list-style: none; margin: 0; padding: 8px 12px; overflow-y: auto; overscroll-behavior: contain;
    scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
    li { padding: 8px 10px 12px; border-radius: 14px; transition: background 300ms; }
    li.current { background: rgba(2, 181, 187, 0.1); box-shadow: inset 3px 0 0 $color-accent; }
    p { margin: 4px 0 0 4px; font: 400 0.95rem/1.6 $font-sans; color: $color-on-dark-muted; max-width: 68ch; }
    li.current p { color: rgba(255, 255, 255, 0.6); }
    .said { color: $color-on-dark; transition: color 200ms; }
  }
  .tr-jump {
    display: inline-flex; align-items: center; gap: 0.6rem; min-height: 36px; padding: 4px 10px 4px 4px; border-radius: 10px;
    border: none; background: none; color: $color-on-dark; cursor: pointer; text-align: left;
    .tr-time { font: 600 0.72rem $font-mono; color: $color-accent; font-variant-numeric: tabular-nums; min-width: 2.6rem; }
    .tr-label { font: 700 0.95rem $font-sans; }
    .tr-go { width: 11px; height: 11px; fill: $color-accent; opacity: 0; transform: translateX(-4px); transition: opacity 160ms, transform 200ms $ease; }
    &:hover, &:focus-visible { background: rgba(255, 255, 255, 0.07); .tr-go { opacity: 1; transform: none; } }
    @include focus-ring;
  }
  .tr-keys {
    border-top: 1px solid $line; padding: 10px 20px 14px;
    h3 { margin: 0 0 8px; font: 600 0.68rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: $color-on-dark-muted; }
    dl { margin: 0; display: flex; flex-wrap: wrap; gap: 8px 18px; }
    div { display: flex; align-items: center; gap: 6px; }
    dt { display: flex; gap: 3px; }
    dd { margin: 0; font: 0.8rem $font-sans; color: $color-on-dark-muted; }
  }

  /* ── Small screens: full width, stacked, above the chat bubble ── */
  @media (max-width: 860px) {
    .bar { width: calc(100vw - 1rem); border-radius: 18px; bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 72px); }
    .row { grid-template-columns: auto minmax(0, 1fr); gap: 0.5rem 0.75rem; padding: 0 10px 10px 6px; }
    .controls { grid-column: 1 / -1; justify-content: space-between; }
    .sep { display: none; }
    .ctl { width: 44px; height: 44px; }
    .caption { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-clamp: 2; min-height: 2.7em; }
    .launcher-time { display: none; }
  }
  @media (pointer: coarse) {
    [data-tip]::after { display: none; }
    .tr-keys { display: none; } // touch screens rarely have a keyboard
  }

  /* ── Preferences ── */
  @include reduced-motion {
    .w, .offer, .offer-backdrop, .launcher, .play, .ctl, .scrub-thumb, .scrub-track, .i-pause, .i-play { transition: none !important; animation: none !important; }
    .w.next { transform: none; }
    .launcher-wave i, .offer-wave i, .launcher-disc::after { animation: none; }
    .bar.buffering .spinner { animation-duration: 2.4s; }
  }
  @media (prefers-contrast: more) {
    .bar, .transcript, .offer { background: #061a1e; border-color: #fff; }
    .meta, .offer-sub, .tr-list p, .notice, .launcher-time, .offer-read { color: #fff; }
    .scrub-track { background: rgba(255, 255, 255, 0.45); }
  }
  @media (forced-colors: active) {
    .bar, .transcript, .offer, .launcher { border: 1px solid CanvasText; }
    .play-wrap canvas, .offer-wave, .launcher-wave { display: none; }
    .launcher-play { opacity: 1; transform: none; }
    .play, .pill, .offer-play { border: 2px solid ButtonText; }
    .w.now { background: none; color: Highlight; -webkit-background-clip: border-box; background-clip: border-box; }
    .w.next { opacity: 1; color: GrayText; }
    .scrub-track { background: GrayText; forced-color-adjust: none; }
    .scrub-fill { background: Highlight; forced-color-adjust: none; }
    .scrub-thumb { background: Highlight; forced-color-adjust: none; transform: scale(1); }
    .tick { background: Canvas; forced-color-adjust: none; }
    .ctl[aria-pressed='true'], .ctl[aria-expanded='true'] { border: 2px solid Highlight; }
    .ctl:disabled { color: GrayText; }
    li.current { border: 2px solid Highlight; }
    .mask { display: none; }
  }
</style>
