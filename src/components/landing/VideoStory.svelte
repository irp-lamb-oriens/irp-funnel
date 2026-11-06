<script lang="ts">
  /**
   * Video player for client stories (Jill Reed's on the home). It fills its
   * parent (the reviews scene's growing frame) and inherits `--g`, the
   * frame's 0..1 growth.
   *
   * - Plays muted on its own while `active` (the frame is on screen, as a
   *   silent preview on the small card and then full size), pauses when it is not, and never auto-plays with reduced motion. A
   *   "Turn on sound" button stays up while it plays muted.
   * - Captions are word by word: lines break before connector words (as in
   *   the narrator), and each word fills as it is spoken. Word times come from
   *   the speaker's phrase times, anchored to the pauses in the audio and
   *   split by syllables (static/landing/jill-reed.json). The same timing is
   *   in a WebVTT track for the browser's own player and full screen on iOS.
   * - Controls: play/pause, a timeline slider (arrows 5 s, Home/End), time,
   *   captions, transcript, sound, full screen. Shortcuts while focus is in
   *   the player: K play/pause, J/L 10 s, M sound, C captions, F full screen.
   *   The bar hides after a few seconds of playback without the pointer and
   *   never while focus is inside the player.
   * - The transcript panel is the text alternative; each sentence seeks.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { formatTime, lineOf, lineStarts, revealedCount, spokenTime, type TimedWord } from '../narration/narration.ts';

  export let src: string;
  export let title: string;
  export let wordsSrc = '';
  export let vttSrc = '';
  /** True while the frame is on screen: plays muted as a preview, then on full size. */
  export let active = false;
  /** True while the frame is big enough for the control bar. */
  export let expanded = false;

  let root: HTMLDivElement;
  let video: HTMLVideoElement;
  let track: HTMLTrackElement;
  let words: TimedWord[] = [];
  let lines: number[] = [];
  let sentences: { start: number; text: string }[] = [];

  let playing = false;
  let muted = true;
  let started = false;
  let buffering = false;
  let captionsOn = true;
  let transcriptOpen = false;
  let fs = false;
  let idle = false;
  let focusInside = false;
  let t = 0;
  let duration = 0;
  let dragT: number | null = null;
  let hoverT: number | null = null;
  let announcement = '';
  let reduce = false;
  let autoplayed = false;
  let raf = 0;
  let idleTimer = 0;
  let scrubEl: HTMLDivElement;

  $: shownT = dragT ?? t;
  $: progress = duration ? Math.min(1, shownT / duration) : 0;
  $: shown = revealedCount(words, t + 0.02);
  $: lineIndex = lines.length ? lineOf(lines, Math.max(0, shown - 1)) : 0;
  $: lineFirst = lines.length ? lines[lineIndex] : 0;
  $: lineWords = lines.length ? words.slice(lineFirst, lineIndex + 1 < lines.length ? lines[lineIndex + 1] : words.length) : [];
  $: speaking = words.length > 0 && t >= words[0].start - 0.2 && t <= words[words.length - 1].end + 0.6;
  $: currentSentence = sentences.reduce((acc, s, i) => (t >= s.start - 0.05 ? i : acc), -1);
  $: showUI = expanded && (!playing || !idle || focusInside || transcriptOpen);
  $: if (video && typeof window !== 'undefined') sync(active);

  async function announce(msg: string) {
    announcement = '';
    await tick();
    announcement = msg;
  }

  onMount(() => {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (wordsSrc) {
      fetch(wordsSrc)
        .then((r) => r.json())
        .then((d: { words: TimedWord[] }) => {
          words = d.words;
          lines = lineStarts(words.map((w) => w.word));
          // Sentences for the transcript (seek targets).
          const out: { start: number; text: string }[] = [];
          let cur: TimedWord[] = [];
          for (const w of words) {
            cur.push(w);
            // Sentences, with long ones split at a comma so each entry stays readable.
            if (/[.!?]$/.test(w.word) || (/,$/.test(w.word) && cur.length >= 12)) {
              out.push({ start: cur[0].start, text: cur.map((x) => x.word).join(' ') });
              cur = [];
            }
          }
          if (cur.length) out.push({ start: cur[0].start, text: cur.map((x) => x.word).join(' ') });
          sentences = out;
        })
        .catch(() => {});
    }
    // Metadata may have loaded before hydration.
    if (video.readyState >= 1 && video.duration) duration = video.duration;
    // Our captions draw on top; the track stays available to the browser.
    if (track?.track) track.track.mode = 'hidden';
    const onFs = () => {
      fs = document.fullscreenElement === root;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    cancelAnimationFrame(raf);
    window.clearTimeout(idleTimer);
  });

  /** Muted autoplay while the frame is on screen; pause when it leaves. */
  function sync(on: boolean) {
    if (reduce) return;
    if (on && video.paused && !autoplayed && !started) {
      autoplayed = true;
      video.muted = true;
      muted = true;
      video.play().catch(() => {});
    } else if (!on && !video.paused) {
      video.pause();
      autoplayed = false;
    }
  }

  function loop() {
    cancelAnimationFrame(raf);
    const frame = () => {
      t = video.currentTime;
      if (!video.paused) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    idle = false;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => (idle = true), 2600);
  }

  function toggle() {
    if (video.paused) {
      started = true;
      video.play().catch(() => {});
    } else video.pause();
    wake();
  }

  /** A tap on the picture first brings the controls back; once they show, it plays or pauses. */
  function onVideoClick() {
    if (!expanded) return;
    if (!showUI) wake();
    else toggle();
  }

  /** The big play button on the small card: plays with sound. */
  function playWithSound() {
    started = true;
    if (muted) video.currentTime = 0;
    video.muted = false;
    muted = false;
    video.play().catch(() => {});
  }

  function setMuted(m: boolean) {
    video.muted = m;
    muted = m;
    if (!m) started = true;
    announce(m ? 'Sound off' : 'Sound on');
    wake();
  }

  function seekTo(time: number) {
    if (!duration) return;
    video.currentTime = Math.max(0, Math.min(duration - 0.05, time));
    t = video.currentTime;
    wake();
  }

  function toggleCaptions() {
    captionsOn = !captionsOn;
    announce(captionsOn ? 'Captions on' : 'Captions off');
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else {
        // iOS Safari: only the video element can go full screen; show the track there.
        const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
        if (track?.track) track.track.mode = captionsOn ? 'showing' : 'hidden';
        v.webkitEnterFullscreen?.();
      }
    } catch {
      /* not allowed */
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && transcriptOpen) {
      e.preventDefault();
      transcriptOpen = false;
      return;
    }
    const k = e.key.toLowerCase();
    const act: Record<string, () => void> = {
      k: toggle,
      j: () => seekTo(video.currentTime - 10),
      l: () => seekTo(video.currentTime + 10),
      m: () => setMuted(!muted),
      c: toggleCaptions,
      f: toggleFullscreen
    };
    if (act[k]) {
      e.preventDefault();
      act[k]();
    }
  }

  function onSliderKey(e: KeyboardEvent) {
    const now = video.currentTime;
    const map: Record<string, () => void> = {
      ArrowLeft: () => seekTo(now - 5),
      ArrowDown: () => seekTo(now - 5),
      ArrowRight: () => seekTo(now + 5),
      ArrowUp: () => seekTo(now + 5),
      PageDown: () => seekTo(now - 10),
      PageUp: () => seekTo(now + 10),
      Home: () => seekTo(0),
      End: () => seekTo(duration),
      ' ': toggle,
      Enter: toggle
    };
    if (map[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      map[e.key]();
    }
  }

  const timeAt = (e: PointerEvent) => {
    const r = scrubEl.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration;
  };
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

  function wordState(k: number, time: number) {
    const w = words[k];
    if (!w || time < w.start) return 'next';
    return time >= w.end ? 'past' : 'now';
  }
  const fill = (k: number, time: number) => {
    const w = words[k];
    return Math.min(1, Math.max(0, (time - w.start) / Math.max(0.05, w.end - w.start)));
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="vp"
  class:expanded
  class:playing
  class:show-ui={showUI}
  class:fs
  class:tr-open={transcriptOpen}
  bind:this={root}
  role="group"
  aria-label="Video: {title}"
  on:pointermove={wake}
  on:keydown={onKey}
  on:focusin={() => ((focusInside = true), wake())}
  on:focusout={(e) => {
    if (!root.contains(e.relatedTarget as Node)) focusInside = false;
  }}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <video
    bind:this={video}
    {src}
    playsinline
    preload="metadata"
    muted
    aria-label={title}
    on:click={onVideoClick}
    on:play={() => ((playing = true), loop(), wake())}
    on:pause={() => ((playing = false), (t = video.currentTime))}
    on:waiting={() => (buffering = true)}
    on:playing={() => (buffering = false)}
    on:loadedmetadata={() => (duration = video.duration)}
    on:durationchange={() => (duration = video.duration || 0)}
    on:seeked={() => (t = video.currentTime)}
    on:ended={() => ((playing = false), announce('Video ended'))}
  >
    {#if vttSrc}<track bind:this={track} kind="captions" src={vttSrc} srclang="en" label="English" default />{/if}
  </video>
  <div class="shade" aria-hidden="true"></div>

  <!-- Word-by-word captions (decorative copy of the track; the transcript is the text alternative). -->
  {#if captionsOn && expanded && speaking && lineWords.length && (started || playing)}
    <p class="cap" aria-hidden="true">
      <span class="cap-box">
        {#each lineWords as w, j (lineFirst + j)}
          {@const k = lineFirst + j}
          {@const st = wordState(k, t)}
          <span class="w {st}" style={st === 'now' ? `--p:${fill(k, t)}` : undefined}>{w.word}</span>{' '}
        {/each}
      </span>
    </p>
  {/if}

  {#if !expanded}
    <button class="big-play" on:click={playWithSound}>
      <span class="bp-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path style="fill:currentColor" d="M8 5.6v12.8a.9.9 0 0 0 1.4.8l10-6.4a.9.9 0 0 0 0-1.6l-10-6.4A.9.9 0 0 0 8 5.6z" /></svg></span>
      <span class="bp-text">Watch with sound</span><span class="sr-only">: {title}</span>
    </button>
  {/if}

  {#if expanded && playing && muted}
    <button class="sound" on:click={() => setMuted(false)}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path style="fill:currentColor" d="M3 7.5h3L10 4v12l-4-3.5H3z" /><path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" d="M13 7.4a3.6 3.6 0 0 1 0 5.2M15.2 5.4a6.4 6.4 0 0 1 0 9.2" /></svg>
      Turn on sound
    </button>
  {/if}

  {#if transcriptOpen}
    <div class="tr" id="vp-transcript" role="region" aria-label="Transcript of {title}">
      <div class="tr-head">
        <h3>Transcript</h3>
        <button class="ic" on:click={() => (transcriptOpen = false)} aria-label="Close transcript">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path style="fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round" d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <ol>
        {#each sentences as s, i}
          <li class:current={i === currentSentence}>
            <button on:click={() => seekTo(s.start)}><time>{formatTime(s.start)}</time><span>{s.text}</span></button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  {#if expanded}
    <div class="bar">
      <div
        class="scrub"
        bind:this={scrubEl}
        role="slider"
        tabindex="0"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shownT)}
        aria-valuetext="{spokenTime(shownT)} of {spokenTime(duration)}"
        on:keydown={onSliderKey}
        on:pointerdown={scrubDown}
        on:pointermove={scrubMove}
        on:pointerup={scrubUp}
        on:pointercancel={scrubUp}
        on:pointerleave={() => dragT === null && (hoverT = null)}
      >
        <span class="track-line" aria-hidden="true">
          {#if hoverT !== null}<span class="ghost" style="transform: scaleX({duration ? hoverT / duration : 0})"></span>{/if}
          <span class="fill" style="transform: scaleX({progress})"></span>
        </span>
        <span class="thumb" aria-hidden="true" style="left: {progress * 100}%"></span>
        {#if hoverT !== null}<span class="tip" aria-hidden="true" style="left: {(hoverT / (duration || 1)) * 100}%">{formatTime(hoverT)}</span>{/if}
      </div>
      <div class="row">
        <button class="ic main" class:buffering on:click={toggle} aria-label={playing ? 'Pause' : 'Play'} aria-keyshortcuts="K">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {#if playing}<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" style="fill:currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" style="fill:currentColor" />
            {:else}<path style="fill:currentColor" d="M8 5.6v12.8a.9.9 0 0 0 1.4.8l10-6.4a.9.9 0 0 0 0-1.6l-10-6.4A.9.9 0 0 0 8 5.6z" />{/if}
          </svg>
        </button>
        <span class="time" aria-hidden="true">{formatTime(shownT)} <i>/</i> {formatTime(duration)}</span>
        <span class="who" aria-hidden="true">{title}</span>
        <button class="ic" on:click={toggleCaptions} aria-label="Captions" aria-pressed={captionsOn} aria-keyshortcuts="C">
          <svg viewBox="0 0 20 16" aria-hidden="true"><rect x="1.5" y="2" width="17" height="12" rx="2.5" style="fill:none;stroke:currentColor;stroke-width:1.6" /><path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" d="M8.6 6.4a2 2 0 1 0 0 3.2M14.4 6.4a2 2 0 1 0 0 3.2" /></svg>
        </button>
        <button class="ic" on:click={() => (transcriptOpen = !transcriptOpen)} aria-label="Transcript" aria-expanded={transcriptOpen} aria-controls="vp-transcript">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" d="M3 4h10M3 8h10M3 12h6" /></svg>
        </button>
        <button class="ic" on:click={() => setMuted(!muted)} aria-label="Mute" aria-pressed={muted} aria-keyshortcuts="M">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path style="fill:currentColor" d="M3 7.5h3L10 4v12l-4-3.5H3z" />
            {#if muted}<path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" />
            {:else}<path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round" d="M13 7.4a3.6 3.6 0 0 1 0 5.2M15.2 5.4a6.4 6.4 0 0 1 0 9.2" />{/if}
          </svg>
        </button>
        <button class="ic" on:click={toggleFullscreen} aria-label={fs ? 'Exit full screen' : 'Full screen'} aria-keyshortcuts="F">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round" d={fs ? 'M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5' : 'M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5'} /></svg>
        </button>
      </div>
    </div>
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>

<style lang="scss">
  @use './tokens' as *;

  .sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

  .vp { position: absolute; inset: 0; background: #000; overflow: hidden; color: #fff; font-family: $font-sans; }
  video {
    width: 100%; height: 100%; object-fit: cover; display: block; background: #000;
    /* While the frame is a small card (its window sits low on the screen), lower the picture so Jill's face is in it. */
    transform: translateY(calc((1 - var(--g, 1)) * 26%)) scale(calc(1.15 - var(--g, 1) * 0.15));
  }
  .expanded video { object-fit: contain; cursor: pointer; }
  .shade {
    position: absolute; inset: auto 0 0 0; height: 46%; pointer-events: none;
    background: linear-gradient(to top, rgba(6, 22, 26, 0.85), rgba(6, 22, 26, 0) 100%);
    opacity: 0; transition: opacity 400ms $ease;
  }
  .show-ui .shade, .expanded:not(.playing) .shade { opacity: 1; }

  /* Captions: one line at a time, words fill as they are spoken */
  .cap {
    position: absolute; left: 0; right: 0; bottom: var(--bar-space, 186px); margin: 0; display: flex; justify-content: center; pointer-events: none;
    transition: bottom 350ms $ease; padding: 0 6vw;
  }
  .vp:not(.show-ui) .cap { --bar-space: 110px; }
  @media (min-width: 900px) { .tr-open .cap { padding-right: calc(min(380px, 100% - 32px) + 56px); } }
  .cap-box {
    max-width: min(920px, 100%); padding: 0.35em 0.7em; border-radius: 12px; background: rgba(6, 18, 21, 0.62);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    font: 700 clamp(1.1rem, 2.1vw, 1.75rem)/1.35 $font-sans; letter-spacing: -0.01em; text-align: center;
  }
  .w { display: inline-block; font-family: $font-sans; transition: opacity 160ms ease, transform 220ms $ease; }
  .w.next { opacity: 0.42; }
  .w.past { color: #fff; }
  .w.now {
    --p: 0;
    background: linear-gradient(90deg, #7fe3e6 calc(var(--p) * 100%), rgba(255, 255, 255, 0.6) calc(var(--p) * 100%));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  .big-play {
    position: absolute; left: 50%; top: 77%; transform: translate(-50%, -50%); z-index: 2;
    display: inline-flex; align-items: center; gap: 12px; padding: 8px 22px 8px 8px; border-radius: 99px; border: none; cursor: pointer;
    background: rgba(255, 255, 255, 0.94); color: $color-ink-strong; font: 700 0.95rem $font-sans; white-space: nowrap;
    box-shadow: 0 20px 40px -14px rgba(0, 0, 0, 0.6); transition: transform 220ms $ease;
    &:hover { transform: translate(-50%, -50%) scale(1.04); }
    @include focus-ring;
  }
  .bp-ic {
    width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: $color-accent; color: $color-ink-strong;
    box-shadow: 0 0 0 8px rgba(2, 181, 187, 0.2);
    svg { width: 20px; height: 20px; margin-left: 2px; }
  }


  .sound {
    position: absolute; right: clamp(16px, 4vw, 48px); top: calc(#{$header-clear} + 8px); z-index: 3;
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px 0 14px; border-radius: 99px; border: none; cursor: pointer;
    background: #fff; color: $color-ink-strong; font: 700 0.9rem $font-sans; box-shadow: 0 14px 30px -12px rgba(0, 0, 0, 0.6);
    animation: sound-in 500ms $ease both;
    svg { width: 20px; height: 20px; }
    &:hover { background: $color-accent-soft; }
    @include focus-ring;
  }
  @keyframes sound-in { from { opacity: 0; transform: translateY(-8px); } }

  /* Control bar: centred, clear of the narrator button (left) and the chat bubble (right) */
  .bar {
    position: absolute; left: 50%; bottom: 80px; z-index: 3; width: min(820px, calc(100% - 200px));
    transform: translateX(-50%); padding: 6px 14px 10px; border-radius: 18px;
    background: rgba(10, 30, 35, 0.72); border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
    box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7);
    opacity: 0; translate: 0 12px; pointer-events: none; transition: opacity 300ms $ease, translate 400ms $ease;
  }
  .show-ui .bar { opacity: 1; translate: 0 0; pointer-events: auto; }
  .bar:focus-within { opacity: 1; translate: 0 0; pointer-events: auto; }
  .scrub { position: relative; height: 22px; cursor: pointer; touch-action: none; border-radius: 6px; outline: none; &:focus-visible { box-shadow: 0 0 0 2px $color-accent; } }
  .track-line { position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; border-radius: 4px; background: rgba(255, 255, 255, 0.2); overflow: hidden; transition: height 160ms, margin 160ms; }
  .scrub:hover .track-line, .scrub:focus-visible .track-line { height: 6px; margin-top: -3px; }
  .fill, .ghost { position: absolute; inset: 0; transform-origin: left; }
  .fill { background: $color-accent; }
  .ghost { background: rgba(255, 255, 255, 0.22); }
  .thumb { position: absolute; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px rgba(2, 181, 187, 0.55); transform: scale(0); transition: transform 180ms $ease; }
  .scrub:hover .thumb, .scrub:focus-visible .thumb { transform: scale(1); }
  .tip { position: absolute; bottom: calc(100% + 6px); transform: translateX(-50%); padding: 4px 8px; border-radius: 7px; background: #fff; color: $color-ink-strong; font: 600 0.72rem $font-mono; pointer-events: none; }
  .row { display: flex; align-items: center; gap: 4px; }
  .time { margin-left: 6px; font: 600 0.78rem $font-mono; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, 0.85); white-space: nowrap; i { font-style: normal; opacity: 0.55; } }
  .who { margin: 0 auto 0 14px; font: 600 0.82rem $font-sans; color: rgba(255, 255, 255, 0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .ic {
    position: relative; width: 40px; height: 40px; flex: none; border-radius: 12px; border: none; cursor: pointer;
    display: grid; place-items: center; background: transparent; color: #fff; transition: background 180ms, transform 160ms $ease;
    svg { width: 20px; height: 20px; }
    &:hover { background: rgba(255, 255, 255, 0.1); }
    &:active { transform: scale(0.92); }
    &[aria-pressed='true'], &[aria-expanded='true'] { background: rgba(2, 181, 187, 0.2); color: #7fe3e6; }
    @include focus-ring;
  }
  .ic.main { width: 44px; height: 44px; border-radius: 50%; background: $color-accent; color: $color-ink-strong; &:hover { background: $color-accent-hover; } }
  .ic.main.buffering::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid transparent; border-top-color: #fff; animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Transcript */
  .tr {
    position: absolute; right: clamp(16px, 3vw, 40px); top: calc(#{$header-clear} + 8px); bottom: 190px; z-index: 4; width: min(380px, calc(100% - 32px));
    display: flex; flex-direction: column; border-radius: 18px; overflow: hidden;
    background: rgba(10, 30, 35, 0.9); border: 1px solid rgba(255, 255, 255, 0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    animation: sound-in 300ms $ease both;
  }
  .tr-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 8px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); h3 { margin: 0; font: 700 0.95rem $font-sans; color: #fff; } }
  .tr ol { list-style: none; margin: 0; padding: 8px; overflow-y: auto; overscroll-behavior: contain; }
  .tr li button {
    display: grid; grid-template-columns: 2.8rem 1fr; gap: 8px; width: 100%; padding: 8px 10px; border-radius: 10px; border: none; cursor: pointer; text-align: left;
    background: transparent; color: rgba(255, 255, 255, 0.78); font: 0.92rem/1.5 $font-sans;
    time { font: 600 0.72rem/1.9 $font-mono; color: #7fe3e6; }
    span { font: inherit; font-family: $font-sans; }
    &:hover { background: rgba(255, 255, 255, 0.07); }
    @include focus-ring;
  }
  .tr li.current button { background: rgba(2, 181, 187, 0.16); color: #fff; }

  .fs .bar { bottom: 32px; }
  .fs .sound, .fs .tr { top: 24px; }

  @media (max-width: 720px) {
    video { object-position: 36% 50%; }
    .big-play { padding: 6px; .bp-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; } }
    .bar { width: calc(100% - 24px); bottom: 84px; }
    .who { display: none; }
    .cap { --bar-space: 190px; }
    .tr { top: 96px; bottom: 200px; }
  }
  @include reduced-motion {
    .w, .bar, .shade, .cap, .thumb { transition: none; }
    .sound, .tr { animation: none; }
  }
  @media (forced-colors: active) {
    .w.now { background: none; color: Highlight; -webkit-background-clip: border-box; background-clip: border-box; }
    .cap-box, .bar, .tr { border: 1px solid CanvasText; }
  }
</style>
