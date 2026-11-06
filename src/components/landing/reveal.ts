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
 * "Book your call" from further down the page: a short cut instead of a long
 * scroll. The screen dips to the hero colour, the page jumps to the booking
 * form, and the form opens on its email step. No fade with reduced motion.
 * Resolves once the form has been asked to open.
 */
export function jumpToBooking(event?: Event): Promise<void> {
  event?.preventDefault();
  const el = document.getElementById('hero-form');
  if (!el) return Promise.resolve();
  const land = () => {
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    history.replaceState(null, '', `${location.pathname}${location.search}#hero-form`);
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    land();
    openBooking(el);
    return Promise.resolve();
  }
  const veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;' +
    'background:radial-gradient(120% 90% at 50% 40%,#15444d 0%,#0e2f36 65%);transition:opacity 200ms cubic-bezier(0.4,0,1,1)';
  document.body.appendChild(veil);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      veil.style.opacity = '1';
      window.setTimeout(() => {
        land();
        // Let the scenes settle on their new scroll position before revealing.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            veil.style.transition = 'opacity 420ms cubic-bezier(0.16,1,0.3,1)';
            veil.style.opacity = '0';
            openBooking(el);
            window.setTimeout(() => veil.remove(), 460);
            resolve();
          })
        );
      }, 210);
    });
  });
}

/** Kept for existing callers: now the same short cut as jumpToBooking. */
export const rewindToBooking = (event?: Event) => void jumpToBooking(event);

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
