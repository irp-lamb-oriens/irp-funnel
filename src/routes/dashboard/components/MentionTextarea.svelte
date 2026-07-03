<script context="module" lang="ts">
  export interface MentionPerson {
    /** Short handle typed after `@` (e.g. the email local-part "luisarmando"). */
    id: string;
    /** Display name. */
    name: string;
    /** Full email the mention resolves to. */
    email: string;
  }
</script>

<script lang="ts">
  /**
   * MentionTextarea — a drop-in <textarea> replacement with a WhatsApp-style
   * "@mention" autocomplete. Typing `@` (at the start of the field or after
   * whitespace) followed by a query opens a smart, searchable, keyboard-driven
   * selector anchored right below the caret.
   *
   * The dropdown is:
   *   • caret-anchored — appears exactly under the `@` the user is typing,
   *     computed via a hidden mirror <div> (textarea-caret-position technique);
   *   • portalled to <body> + position:fixed — so it is never clipped by the
   *     Detail Panel's overflow/scroll/transform;
   *   • viewport-aware on X — if it would collide with the right edge it slides
   *     left so its full width stays inside the viewport (min 8px margin);
   *   • viewport-aware on Y — prefers opening below the caret, flips above when
   *     there isn't enough room, and its height is a fluid `clamp()` (min one
   *     row, max ~40vh) with internal scroll.
   *
   * On selection it inserts `@<id> ` into the text and dispatches `mention`
   * with the chosen person so the parent can (e.g.) add their email to the
   * note recipients. Fully backward compatible: with no `@` typed it behaves
   * exactly like a normal bound textarea.
   */
  import { createEventDispatcher, tick, onDestroy } from 'svelte';

  // ── Props ──────────────────────────────────────────────────────────────────
  export let value = '';
  export let people: MentionPerson[] = [];
  export let placeholder = '';
  export let rows = 3;
  export let disabled = false;
  // `class` is reserved — expose it via an alias so callers can style the box.
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{ mention: MentionPerson }>();

  // ── Element refs + menu state ────────────────────────────────────────────
  let ta: HTMLTextAreaElement;
  let menuEl: HTMLDivElement | null = null;

  let open = false;
  let ready = false;                 // becomes true once the menu is positioned
  let query = '';
  let mentionStart = -1;             // index of the triggering `@`
  let activeIndex = 0;
  let menuX = 0;
  let menuY = 0;
  let placement: 'below' | 'above' = 'below';

  // ── Filtering ────────────────────────────────────────────────────────────
  $: q = query.trim().toLowerCase();
  $: filtered = open
    ? people
        .filter(
          (p) =>
            !q ||
            p.id.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q),
        )
        .slice(0, 50)
    : [];
  // Keep the highlighted row in range whenever the list shrinks.
  $: if (activeIndex >= filtered.length) activeIndex = 0;
  // The menu is only visually rendered when there's at least one match.
  $: showMenu = open && filtered.length > 0;

  function initials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  // ── Mention detection ──────────────────────────────────────────────────────
  function detectMention() {
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const at = before.lastIndexOf('@');
    if (at === -1) return closeMenu();

    // The `@` must be at the very start or immediately preceded by whitespace,
    // so we never trigger inside an email address the operator is typing.
    const prevChar = at > 0 ? before[at - 1] : '';
    if (at !== 0 && !/\s/.test(prevChar)) return closeMenu();

    const token = before.slice(at + 1);
    // A mention handle is a single "word" — bail the moment it contains a space.
    if (/\s/.test(token)) return closeMenu();
    // Guard against absurdly long tokens (paste, etc.).
    if (token.length > 40) return closeMenu();

    const wasClosed = !open || mentionStart !== at;
    query = token;
    mentionStart = at;
    open = true;
    if (wasClosed) activeIndex = 0;
    updatePosition();
  }

  function closeMenu() {
    open = false;
    ready = false;
    query = '';
    mentionStart = -1;
  }

  // ── Caret coordinates via a hidden mirror div ──────────────────────────────
  const MIRROR_PROPS = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom',
    'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
    'fontSize', 'fontFamily', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'textAlign', 'textTransform', 'textIndent', 'whiteSpace', 'tabSize',
  ] as const;

  function getCaretCoordinates(
    el: HTMLTextAreaElement,
    position: number,
  ): { top: number; left: number; height: number } {
    const div = document.createElement('div');
    const computed = getComputedStyle(el);
    const s = div.style as any;
    const c = computed as any;
    s.position = 'absolute';
    s.visibility = 'hidden';
    s.whiteSpace = 'pre-wrap';
    s.wordWrap = 'break-word';
    s.overflow = 'hidden';
    for (const prop of MIRROR_PROPS) s[prop] = c[prop];

    div.textContent = el.value.slice(0, position);
    const span = document.createElement('span');
    // A non-breaking marker so a caret at the very end still has a box.
    span.textContent = el.value.slice(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);
    let lineHeight = parseInt(computed.lineHeight);
    if (Number.isNaN(lineHeight)) lineHeight = Math.floor(parseInt(computed.fontSize) * 1.2);
    const coords = {
      top: span.offsetTop + parseInt(computed.borderTopWidth || '0'),
      left: span.offsetLeft + parseInt(computed.borderLeftWidth || '0'),
      height: lineHeight,
    };
    document.body.removeChild(div);
    return coords;
  }

  async function updatePosition() {
    if (!ta || mentionStart < 0) return;
    const coords = getCaretCoordinates(ta, mentionStart);
    const rect = ta.getBoundingClientRect();
    const caretLeft = rect.left + coords.left - ta.scrollLeft;
    const caretTop = rect.top + coords.top - ta.scrollTop;
    const caretBottom = caretTop + coords.height;

    await tick(); // wait for the menu to render so we can measure it
    if (!menuEl) return;
    const mW = menuEl.offsetWidth;
    const mH = menuEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // X — never let the menu's right edge cross the viewport boundary.
    let x = caretLeft;
    if (x + mW + margin > vw) x = vw - mW - margin;
    if (x < margin) x = margin;

    // Y — open below the caret unless there isn't room, then flip above.
    const spaceBelow = vh - caretBottom;
    if (spaceBelow >= mH + margin || spaceBelow >= caretTop) {
      menuY = caretBottom + 4;
      placement = 'below';
    } else {
      menuY = caretTop - mH - 4;
      placement = 'above';
    }
    menuY = Math.max(margin, Math.min(menuY, vh - mH - margin));
    menuX = x;
    ready = true;
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  async function choose(person: MentionPerson) {
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const insert = `@${person.id} `;
    value = before + insert + after;
    const newPos = (before + insert).length;
    dispatch('mention', person);
    closeMenu();
    await tick();
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  function onInput() {
    detectMention();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!showMenu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % filtered.length;
      scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
      scrollActiveIntoView();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  }

  function onKeyup(e: KeyboardEvent) {
    // Navigation keys are fully handled in keydown; don't let them re-run
    // detection (which would fight the highlight) — but caret-moving keys
    // (Home/End/←/→) SHOULD re-evaluate the mention context.
    if (open && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
    detectMention();
  }

  function onClickTextarea() {
    detectMention();
  }

  function onBlur() {
    // Delay so a click on a menu option (which fires mousedown → blur) still
    // registers. mousedown handlers on options preventDefault to keep focus.
    setTimeout(() => closeMenu(), 120);
  }

  async function scrollActiveIntoView() {
    await tick();
    const el = menuEl?.querySelector<HTMLElement>('.mt-opt.is-active');
    el?.scrollIntoView({ block: 'nearest' });
  }

  function onReposition() {
    if (open) updatePosition();
  }

  // Keep the menu glued to the caret while the page/panel scrolls or resizes.
  $: if (typeof window !== 'undefined') {
    if (open) {
      window.addEventListener('scroll', onReposition, true);
      window.addEventListener('resize', onReposition);
    } else {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    }
  }

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    }
  });

  // Tiny portal action — relocates the menu to <body> so it escapes any
  // clipping/transform on the Detail Panel and is positioned against the viewport.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.parentNode?.removeChild(node);
      },
    };
  }
</script>

<textarea
  bind:this={ta}
  bind:value
  {placeholder}
  {rows}
  {disabled}
  class={className}
  on:input={onInput}
  on:keydown={onKeydown}
  on:keyup={onKeyup}
  on:click={onClickTextarea}
  on:blur={onBlur}
></textarea>

{#if showMenu}
  <div
    class="mt-menu {placement}"
    class:ready
    role="listbox"
    bind:this={menuEl}
    use:portal
    style="left:{menuX}px; top:{menuY}px;"
  >
    {#each filtered as p, i (p.email)}
      <button
        type="button"
        role="option"
        aria-selected={i === activeIndex}
        class="mt-opt"
        class:is-active={i === activeIndex}
        on:mousedown|preventDefault={() => choose(p)}
        on:mouseenter={() => (activeIndex = i)}
      >
        <span class="mt-opt__avatar">{initials(p.name)}</span>
        <span class="mt-opt__body">
          <span class="mt-opt__name">{p.name}</span>
          <span class="mt-opt__handle">@{p.id}</span>
        </span>
        <span class="mt-opt__email">{p.email}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .mt-menu {
    position: fixed;
    z-index: 4000;
    min-width: 240px;
    max-width: min(340px, calc(100vw - 16px));
    /* Fluid height: at least one row, at most ~40vh, scroll beyond. */
    max-height: clamp(52px, 40vh, 360px);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 6px;
    border-radius: 14px;
    background: #10131a;
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow:
      0 18px 48px -12px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(0, 0, 0, 0.35);
    /* Hidden until positioned to avoid a first-frame flash at (0,0). */
    visibility: hidden;
    opacity: 0;
    transform: translateY(4px) scale(0.98);
    transform-origin: top left;
    transition: opacity 0.12s ease, transform 0.12s ease;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .mt-menu.above {
    transform-origin: bottom left;
    transform: translateY(-4px) scale(0.98);
  }
  .mt-menu.ready {
    visibility: visible;
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .mt-menu::-webkit-scrollbar {
    width: 8px;
  }
  .mt-menu::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.14);
    border-radius: 8px;
  }

  .mt-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    color: #e6e9ef;
    transition: background 0.1s ease;
  }
  .mt-opt.is-active,
  .mt-opt:hover {
    background: rgba(99, 102, 241, 0.18);
  }
  .mt-opt__avatar {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }
  .mt-opt__body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .mt-opt__name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mt-opt__handle {
    font-size: 11px;
    color: #8b93a7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mt-opt__email {
    flex: 0 0 auto;
    max-width: 42%;
    font-size: 10.5px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
