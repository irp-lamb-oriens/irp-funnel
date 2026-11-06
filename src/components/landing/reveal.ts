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
