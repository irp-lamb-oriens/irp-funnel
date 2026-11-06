<script lang="ts">
  /**
   * Scene 11, "What our clients say", in three parts:
   * 1. Jill Reed's video grows from a card into the whole screen.
   * 2. Real routes from the Google reviews draw on a dotted map (Dallas to
   *    Costa Rica, Indianapolis to Portugal, Australia to Guanacaste) and
   *    each review rises where its route lands.
   * 3. The review wall (VerticalReviewMarquee, infinite vertical carousels).
   */
  import { scene, seg, easeOut, easeInOut } from './scene.ts';
  import Globe from './Globe.svelte';
  import VerticalReviewMarquee from '../VerticalReviewMarquee.svelte';
  import { googleReviews } from '../../lib/reviews.ts';
  import { PROOF } from './content.ts';

  let pv = 0;
  let pr = 0;
  let video: HTMLVideoElement;

  $: grow = easeInOut(seg(pv, 0.05, 0.55));
  $: capIn = 1 - seg(pv, 0.1, 0.28);
  $: expanded = grow > 0.85;
  // Full screen: play muted (the visitor can unmute with the controls). Shrinking pauses it.
  let autoplayed = false;
  // Plays muted only while the frame is full and on screen.
  let videoInView = false;
  function watchVideo(node: HTMLElement) {
    const io = new IntersectionObserver(([e]) => (videoInView = e.isIntersecting && e.intersectionRatio > 0.5), { threshold: [0, 0.5, 1] });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }
  $: if (video && typeof window !== 'undefined') syncVideo(expanded && videoInView);
  function syncVideo(open: boolean) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (open && video.paused && !autoplayed) {
      autoplayed = true;
      video.muted = true;
      video.play().catch(() => {});
    } else if (!open && !video.paused && autoplayed) {
      video.pause();
      autoplayed = false;
    }
  }

  const pick = (name: string) => googleReviews.find((r) => r.name === name)!;
  const firstSentence = (q: string) => (q.match(/^.*?[.!?](\s|$)/)?.[0] ?? q).trim();
  const ROUTES = [
    { from: [-96.8, 32.8] as [number, number], to: [-84.1, 9.9] as [number, number], r: pick('Teresa Health') },
    { from: [-86.2, 39.8] as [number, number], to: [-8.5, 37.1] as [number, number], r: pick('Jeanne Fuqua') },
    { from: [133.8, -25.3] as [number, number], to: [-85.5, 10.6] as [number, number], r: pick('Angela Hryniuk') }
  ];
  $: arcT = (k: number) => easeInOut(seg(pr, 0.06 + k * 0.28, 0.06 + k * 0.28 + 0.16));
  $: cardIn = (k: number) => easeOut(seg(pr, 0.06 + k * 0.28 + 0.14, 0.06 + k * 0.28 + 0.24));
  $: arcs = ROUTES.map((x, k) => ({ from: x.from, to: x.to, t: arcT(k) }));
  $: markers = ROUTES.flatMap((x, k) => [
    { lon: x.from[0], lat: x.from[1], on: false },
    { lon: x.to[0], lat: x.to[1], on: arcT(k) >= 1 }
  ]);
  $: activeRoute = [2, 1, 0].find((k) => cardIn(k) > 0.05) ?? -1;
</script>

<div id="reviews" class="reviews">
  <section class="scene video-scene" style="--len:2.4" use:scene={(v) => (pv = v)} aria-labelledby="reviews-title">
    <div class="stage">
      <header class="head wrap" style="opacity:{capIn}; transform: translateY({(1 - capIn) * -30}px)">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>{PROOF.eyebrow}</p>
        <h2 class="title" id="reviews-title">{PROOF.title}</h2>
      </header>
      <figure class="frame" class:expanded style="--g:{grow}">
        <video bind:this={video} use:watchVideo controls={expanded} playsinline preload="metadata" src={PROOF.videoSrc} aria-label={PROOF.videoTitle}></video>
        {#if !expanded}
          <button class="play" on:click={() => { video?.play(); }} aria-label="Play {PROOF.videoTitle}">▶</button>
        {/if}
        <figcaption>{PROOF.videoTitle}</figcaption>
      </figure>
    </div>
  </section>

  <section class="scene routes" style="--len:3.2" use:scene={(v) => (pr = v)} aria-label="Where our clients moved from">
    <div class="stage">
      <div class="map" aria-hidden="true">
        <Globe mode="flat" lon={-30} scale={1.05} {arcs} {markers} dot="rgba(214,250,251,0.5)" />
      </div>
      <div class="wrap layer">
        <p class="eyebrow light"><span class="dot" aria-hidden="true"></span>Routes from our Google reviews</p>
        <ul class="cards">
          {#each ROUTES as x, k}
            <li class="rcard-li" style="opacity:{cardIn(k)}; transform: translateY({(1 - cardIn(k)) * 40}px) rotate({(k - 1) * 1.5}deg)">
              <a class="rcard" class:front={activeRoute === k} href={x.r.link} target="_blank" rel="noopener noreferrer" aria-label="Read {x.r.name}'s Google review (opens in a new tab)" tabindex={cardIn(k) > 0.5 ? 0 : -1}>
                <span class="stars" aria-hidden="true">★★★★★</span>
                <blockquote>{firstSentence(x.r.quote)}</blockquote>
                <p class="who"><b>{x.r.name}</b><span>{x.r.route}</span></p>
                <span class="g-link">Read on Google ↗</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </section>

  <!-- 3. The review wall: infinite vertical carousels per column, as on the previous home. -->
  <VerticalReviewMarquee
    title="What Our Customers Say"
    subtitle="Real reviews from clients who moved their lives with us."
    background="#ffffff"
    pauseOnHover={false}
    id="reviews-wall"
  />
</div>

<style lang="scss">
  @use './tokens' as *;

  .wrap { @include container; }
  .scene { @include scene-shell; }
  .stage { @include stage; }
  .eyebrow { @include eyebrow; display: inline-flex; align-items: center; gap: $space-2; color: $color-on-dark; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: $color-accent; }

  /* 1. Video */
  .video-scene { background: $color-ink-strong; color: $color-on-dark; }
  .video-scene .stage { display: flex; flex-direction: column; justify-content: center; }
  .head { position: absolute; top: $header-clear; left: 0; right: 0; z-index: 2; display: flex; flex-direction: column; gap: $space-3; }
  .title { @include heading-xl; color: $color-on-dark; font-size: clamp(1.9rem, 3.6vw, 3rem); }
  .frame {
    --g: 0;
    position: absolute; inset: 0; margin: 0;
    clip-path: inset(calc((1 - var(--g)) * 36%) calc((1 - var(--g)) * 26%) calc((1 - var(--g)) * 14%) calc((1 - var(--g)) * 26%) round calc((1 - var(--g)) * 28px));
    will-change: clip-path;
    video { width: 100%; height: 100%; object-fit: cover; display: block; background: #000; transform: scale(calc(1.15 - var(--g) * 0.15)); }
    figcaption { position: absolute; left: 50%; bottom: calc((1 - var(--g)) * 14% + 16px); transform: translateX(-50%); font: 0.75rem $font-mono; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255, 255, 255, 0.85); opacity: calc(1 - var(--g)); white-space: nowrap; }
    &.expanded video { object-fit: contain; }
  }
  .play {
    position: absolute; left: 50%; top: 61%; transform: translate(-50%, -50%); width: 84px; height: 84px; border-radius: 50%;
    border: none; background: $color-accent; color: $color-ink-strong; font-size: 1.6rem; cursor: pointer;
    box-shadow: 0 0 0 12px rgba(2, 181, 187, 0.2); @include focus-ring;
  }

  /* 2. Routes */
  .routes { background: #0b262c; color: $color-on-dark; }
  .map { position: absolute; inset: 8% -4% 4%; }
  .layer { position: relative; height: 100%; display: flex; flex-direction: column; padding-top: $header-clear; padding-bottom: 6.5rem; }
  .cards { list-style: none; margin: auto 0 0; padding: 0; display: grid; gap: $space-4; @include lg { grid-template-columns: repeat(3, 1fr); } }
  .rcard-li { will-change: transform; @media (max-width: 1023px) { &:not(:has(.front)) { display: none; } } }
  .g-link { margin-top: auto; font: 600 0.8rem $font-sans; color: $color-accent-hover; }
  .rcard {
    height: 100%; text-decoration: none; transition: transform 300ms $ease, box-shadow 300ms;
    padding: $space-6; border-radius: 16px; background: rgba(255, 255, 255, 0.96); color: $color-ink;
    box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.7); display: flex; flex-direction: column; gap: $space-3;
    @include focus-ring;
    @include hover-only { &:hover { transform: translateY(-4px); box-shadow: 0 40px 60px -30px rgba(0, 0, 0, 0.8); } }
    blockquote { margin: 0; font: 600 1.05rem/1.5 $font-sans; color: $color-ink-strong; }
    &.front { outline: 3px solid $color-accent; }
  }
  .stars { color: #f5a623; letter-spacing: 2px; }
  .who { margin: 0; display: flex; flex-direction: column; b { font: 700 0.95rem $font-sans; } span { font: 0.82rem $font-sans; color: $color-muted; } }

  :global(.rm) {
    .stage { height: 100vh; height: 100svh; }
    .rcard-li { opacity: 1 !important; transform: none !important; }
  }
</style>
