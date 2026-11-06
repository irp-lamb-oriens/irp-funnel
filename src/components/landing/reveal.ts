/**
 * `use:reveal` adds `.is-in` once the element enters the viewport, so CSS can
 * run the entrance (see the `reveal` mixin in _tokens.scss). One shared
 * observer for the whole page; reduced motion is handled in CSS.
 */
let observer: IntersectionObserver | null = null;

function getObserver() {
  if (observer || typeof window === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          observer?.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );
  return observer;
}

export function reveal(node: HTMLElement) {
  const io = getObserver();
  if (!io) {
    node.classList.add('is-in');
    return {};
  }
  io.observe(node);
  return {
    destroy() {
      io.unobserve(node);
    }
  };
}

/** Smooth-scroll to the booking form and move focus into it. */
export function goToBooking(event?: Event) {
  event?.preventDefault();
  const el = document.getElementById('hero-form');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#hero-form');
  const target = el.querySelector<HTMLElement>('button, input, a[href]');
  window.setTimeout(() => target?.focus({ preventScroll: true }), reduce ? 0 : 700);
}

/**
 * "Book your call" at the end of the page: rewind the whole page to the
 * booking form in one eased motion (about 1.2 s, through every section),
 * then focus the form. Instant with reduced motion.
 */
export function rewindToBooking(event?: Event) {
  event?.preventDefault();
  const el = document.getElementById('hero-form');
  if (!el) return;
  const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
  const focus = () => {
    history.replaceState(null, '', '#hero-form');
    openBooking(el);
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    window.scrollTo({ top: target, behavior: 'auto' });
    return focus();
  }
  const from = window.scrollY;
  const d = target - from;
  const ms = Math.min(1600, Math.max(900, Math.abs(d) / 12));
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    const e = p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2;
    window.scrollTo({ top: from + d * e, behavior: 'instant' as ScrollBehavior });
    if (p < 1) requestAnimationFrame(step);
    else focus();
  };
  requestAnimationFrame(step);
}

/**
 * Open the booking flow in HeroForm as if the visitor pressed its main
 * button: HeroForm's own click handler records the Evo interaction, moves to
 * the email step and focuses the email field. If the form is already past
 * its first screen, only focus it. The form frame gets a short highlight.
 */
export function openBooking(root: HTMLElement | null = document.getElementById('hero-form')) {
  if (!root) return;
  const container = root.querySelector<HTMLElement>('#hero-form-container');
  if (container) {
    container.classList.remove('irp-arrive');
    void container.offsetWidth;
    container.classList.add('irp-arrive');
    window.setTimeout(() => container.classList.remove('irp-arrive'), 1400);
  }
  const start = root.querySelector<HTMLButtonElement>('.cta-hero__btn');
  if (start) {
    window.setTimeout(() => start.click(), 250);
    return;
  }
  root.querySelector<HTMLElement>('input, button, a[href]')?.focus({ preventScroll: true });
}
