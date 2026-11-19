/**
 * use:tabs — keyboard + ARIA for any row of tab or segment buttons.
 *
 *   <nav class="irp-tabs" use:tabs={{ label: 'Finance sections' }}> …buttons… </nav>
 *   <div class="mh-seg" use:tabs={{ mode: 'toggle' }}> …aria-pressed buttons… </div>
 *
 * mode 'tabs'   (default) role=tablist on the row, role=tab + aria-selected on
 *               each button. Arrow keys / Home / End move AND activate
 *               (automatic activation, WAI-ARIA APG "Tabs").
 * mode 'toggle' keeps toggle-button semantics (role=group + aria-pressed).
 *               Arrow keys move focus only; Space/Enter activates as usual.
 *
 * Either way the row is ONE tab stop (roving tabindex): Tab enters on the
 * active item and leaves the row; arrows walk inside it.
 *
 * The active item is read from whatever the component already renders —
 * .active, .is-active, a BEM `--active` modifier, or its own aria-selected /
 * aria-pressed / aria-current — so adopting this needs no state changes.
 * A MutationObserver keeps ARIA in sync when the component re-renders.
 * A button that lives in the row but is not a tab (e.g. Reload) takes
 * `data-tab-skip`; it keeps its own role and tab stop.
 */
export type TabsOptions = { mode?: 'tabs' | 'toggle'; label?: string; vertical?: boolean };

const CLASS_ACTIVE = (el: Element) =>
  el.classList.contains('active') ||
  el.classList.contains('is-active') ||
  Array.from(el.classList).some((c) => c.endsWith('--active'));

const ARIA_ACTIVE = (el: Element) =>
  el.getAttribute('aria-selected') === 'true' ||
  el.getAttribute('aria-pressed') === 'true' ||
  el.getAttribute('aria-current') === 'true' ||
  el.getAttribute('aria-current') === 'page';

const isDisabled = (el: HTMLElement) =>
  (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';

export function tabs(node: HTMLElement, options: TabsOptions = {}) {
  let opts = options;

  const items = () =>
    Array.from(node.children).filter(
      (el): el is HTMLElement =>
        (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) && !el.hasAttribute('data-tab-skip'),
    );

  // If the component signals state with classes, we own the ARIA attributes.
  // If it already renders aria-selected / aria-pressed itself, we leave them.
  const classDriven = () => items().some(CLASS_ACTIVE);
  const activeOf = (list: HTMLElement[]) =>
    classDriven() ? list.find(CLASS_ACTIVE) : list.find(ARIA_ACTIVE);

  const observer = new MutationObserver(() => sync());
  const observe = () =>
    observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'aria-current', 'disabled'],
    });

  function sync() {
    observer.disconnect();
    const list = items();
    const mode = opts.mode ?? 'tabs';
    const owned = classDriven();
    const active = activeOf(list);

    if (mode === 'tabs') node.setAttribute('role', 'tablist');
    else if (!node.hasAttribute('role')) node.setAttribute('role', 'group');
    if (opts.vertical) node.setAttribute('aria-orientation', 'vertical');
    if (opts.label && !node.hasAttribute('aria-label') && !node.hasAttribute('aria-labelledby')) {
      node.setAttribute('aria-label', opts.label);
    }

    const focusable = active && !isDisabled(active) ? active : list.find((el) => !isDisabled(el));
    for (const el of list) {
      if (mode === 'tabs') {
        el.setAttribute('role', 'tab');
        if (owned || !el.hasAttribute('aria-selected')) el.setAttribute('aria-selected', String(el === active));
      } else if (el instanceof HTMLButtonElement && (owned || !el.hasAttribute('aria-pressed'))) {
        el.setAttribute('aria-pressed', String(el === active));
      }
      el.tabIndex = el === focusable ? 0 : -1;
    }
    observe();
  }

  function onKeydown(e: KeyboardEvent) {
    const list = items().filter((el) => !isDisabled(el));
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = opts.vertical ? 'ArrowDown' : 'ArrowRight';
    const prev = opts.vertical ? 'ArrowUp' : 'ArrowLeft';
    let j: number;
    if (e.key === next) j = (i + 1) % list.length;
    else if (e.key === prev) j = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    else return;
    e.preventDefault();
    const target = list[j];
    for (const el of items()) el.tabIndex = el === target ? 0 : -1;
    target.focus();
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if ((opts.mode ?? 'tabs') === 'tabs') target.click();
  }

  node.addEventListener('keydown', onKeydown);
  sync();

  return {
    update(next: TabsOptions = {}) {
      opts = next;
      sync();
    },
    destroy() {
      observer.disconnect();
      node.removeEventListener('keydown', onKeydown);
    },
  };
}
