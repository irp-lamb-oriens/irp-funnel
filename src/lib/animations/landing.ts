// Centralized, dependency-light GSAP animation engine for the public landing
// surfaces (relocation-tours, real-estate, homepage ServicesSection, and the
// gated FullRelocationSupport panel). One vocabulary, reused everywhere, so the
// motion language stays cohesive and page components only add data-attributes.
//
// Contract:
//   const cleanup = await initLanding(rootEl);
//   onDestroy(cleanup);
//
// It is SSR-safe (dynamic-imports gsap only in the browser) and fully honours
// prefers-reduced-motion (collapses to instant, no movement). All motion is
// transform/opacity only, so it stays on the GPU.
//
// Data-attribute API (put these in markup):
//   data-animate="up|fade|scale|left|right|blur"   scroll-reveal on enter
//   data-animate-delay="0.1"                        extra per-element delay (s)
//   data-parallax="0.15"                            scroll-scrub Y drift (ratio)
//   data-magnetic                                   pointer-pull (buttons/cards)
//   data-magnetic-strength="0.4"                    pull strength (default 0.35)
//   data-tilt                                       3D tilt + spotlight on hover
//   data-marquee                                    infinite horizontal loop

export type LandingCleanup = () => void;

const EASE = 'expo.out';

export async function initLanding(root: HTMLElement): Promise<LandingCleanup> {
  if (typeof window === 'undefined' || !root) return () => {};

  const reduce =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger')
  ]);
  gsap.registerPlugin(ScrollTrigger);

  const disposers: Array<() => void> = [];

  const ctx = gsap.context(() => {
    const revealEls = Array.from(
      root.querySelectorAll<HTMLElement>('[data-animate]')
    );

    if (reduce) {
      gsap.set(revealEls, { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' });
      return;
    }

    // ── Scroll reveals (grouped so neighbours cascade together) ──────────
    const fromFor = (el: HTMLElement) => {
      const kind = el.dataset.animate || 'up';
      const base: gsap.TweenVars = { opacity: 0 };
      if (kind === 'up') base.y = 46;
      else if (kind === 'left') base.x = -54;
      else if (kind === 'right') base.x = 54;
      else if (kind === 'scale') { base.scale = 0.92; base.y = 24; }
      else if (kind === 'blur') { base.filter = 'blur(14px)'; base.y = 24; }
      return base;
    };

    revealEls.forEach((el) => gsap.set(el, fromFor(el)));

    ScrollTrigger.batch(revealEls, {
      start: 'top 85%',
      once: true,
      onEnter: (batch) => {
        batch.forEach((el, i) => {
          const node = el as HTMLElement;
          const extra = parseFloat(node.dataset.animateDelay || '0') || 0;
          gsap.to(node, {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 1.05,
            ease: EASE,
            delay: extra + i * 0.08,
            onComplete: () => gsap.set(node, { clearProps: 'filter' })
          });
        });
      }
    });

    // ── Parallax (scrub) ─────────────────────────────────────────────────
    root
      .querySelectorAll<HTMLElement>('[data-parallax]')
      .forEach((el) => {
        const ratio = parseFloat(el.dataset.parallax || '0.15') || 0.15;
        gsap.to(el, {
          yPercent: -ratio * 100,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
      });

    // ── Infinite marquee ─────────────────────────────────────────────────
    root
      .querySelectorAll<HTMLElement>('[data-marquee]')
      .forEach((el) => {
        const track = el.firstElementChild as HTMLElement | null;
        if (!track) return;
        const distance = track.scrollWidth / 2;
        gsap.to(track, {
          x: -distance,
          duration: distance / 60,
          ease: 'none',
          repeat: -1
        });
      });
  }, root);

  // ── Magnetic pointer pull (outside ctx so we control listeners) ────────
  if (!reduce) {
    root
      .querySelectorAll<HTMLElement>('[data-magnetic]')
      .forEach((el) => {
        const strength =
          parseFloat(el.dataset.magneticStrength || '0.35') || 0.35;
        const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * strength);
          yTo((e.clientY - (r.top + r.height / 2)) * strength);
        };
        const onLeave = () => { xTo(0); yTo(0); };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        disposers.push(() => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });

    // ── Tilt + spotlight cards ───────────────────────────────────────────
    root
      .querySelectorAll<HTMLElement>('[data-tilt]')
      .forEach((el) => {
        const rotX = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3.out' });
        const rotY = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3.out' });
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          rotY((px - 0.5) * 10);
          rotX((0.5 - py) * 10);
          el.style.setProperty('--mx', `${px * 100}%`);
          el.style.setProperty('--my', `${py * 100}%`);
          el.style.setProperty('--spot', '1');
        };
        const onEnter = () =>
          gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });
        const onLeave = () => {
          rotX(0);
          rotY(0);
          el.style.setProperty('--spot', '0');
        };
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        disposers.push(() => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        });
      });
  }

  return () => {
    disposers.forEach((d) => d());
    ctx.revert();
  };
}