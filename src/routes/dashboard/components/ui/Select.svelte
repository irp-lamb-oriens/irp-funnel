<script lang="ts" context="module">
  /**
   * A single option in the <Select> dropdown.
   * `value` is the stable key; `label` is what the user reads. Everything else
   * is optional eye-candy: an emoji `icon`, a short `description` line, a small
   * pill `badge`, and a per-option `disabled` flag.
   */
  export interface SelectOption {
    value: string;
    label: string;
    description?: string | null;
    badge?: string | null;
    icon?: string | null;
    disabled?: boolean;
  }
</script>

<script lang="ts">
  /**
   * Select.svelte — a beautiful, accessible, native-free dropdown for the
   * light dashboard theme (matches QuotesTab / TemplatesView tokens:
   * #0f172a text · #e2e8f0 borders · #02b6bc teal accent · 10px radius).
   *
   * • Button trigger + animated chevron + floating listbox (body-portaled and
   *   position:fixed so it never gets clipped by overflow:hidden panels).
   * • Full keyboard nav: ↑/↓ Home/End to move, Enter/Space to pick,
   *   Esc to close, Tab to close-and-advance.
   * • Optional fuzzy search box. Click-outside + scroll/resize reposition.
   * • Emits `change` → `{ value }`. Two-way `value` prop also stays in sync.
   *
   * Purely presentational — zero data assumptions, reuse anywhere.
   */
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { fly } from 'svelte/transition';

  export let options: SelectOption[] = [];
  export let value = '';
  export let placeholder = 'Select…';
  export let disabled = false;
  export let searchable = false;
  export let searchPlaceholder = 'Search…';
  export let ariaLabel: string | undefined = undefined;
  /** 'md' (default) for forms; 'sm' for compact inline rows. */
  export let size: 'sm' | 'md' = 'md';
  export let id: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: { value: string } }>();

  let open = false;
  let triggerEl: HTMLButtonElement;
  let menuEl: HTMLDivElement | null = null;
  let searchEl: HTMLInputElement | null = null;
  let highlightedIndex = -1;
  let search = '';
  let menuStyle = '';

  $: selectedOption = options.find((o) => o.value === value) ?? null;
  $: filtered =
    searchable && search.trim()
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            (o.description ?? '').toLowerCase().includes(search.toLowerCase()),
        )
      : options;
  // Keep the highlight in range whenever the filtered list shrinks.
  $: if (open && highlightedIndex > filtered.length - 1) {
    highlightedIndex = filtered.length - 1;
  }

  /** Move the menu node onto <body> so overflow:hidden ancestors can't clip it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  function positionMenu() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom;
    const MENU_MAX = 320;
    const openUp = spaceBelow < 240 && r.top > spaceBelow;
    if (openUp) {
      menuStyle =
        `left:${r.left}px; width:${r.width}px; bottom:${vh - r.top + 6}px; ` +
        `max-height:${Math.min(MENU_MAX, r.top - 12)}px;`;
    } else {
      menuStyle =
        `left:${r.left}px; width:${r.width}px; top:${r.bottom + 6}px; ` +
        `max-height:${Math.min(MENU_MAX, spaceBelow - 12)}px;`;
    }
  }

  async function openMenu() {
    if (disabled) return;
    open = true;
    search = '';
    await tick();
    positionMenu();
    const selIdx = filtered.findIndex((o) => o.value === value);
    highlightedIndex = selIdx >= 0 ? selIdx : 0;
    window.addEventListener('scroll', positionMenu, true);
    window.addEventListener('resize', positionMenu);
    if (searchable && searchEl) searchEl.focus();
    scrollHighlightedIntoView();
  }

  function closeMenu() {
    open = false;
    window.removeEventListener('scroll', positionMenu, true);
    window.removeEventListener('resize', positionMenu);
  }

  function toggle() {
    open ? closeMenu() : openMenu();
  }

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    if (opt.value !== value) {
      value = opt.value;
      dispatch('change', { value: opt.value });
    }
    closeMenu();
    triggerEl?.focus();
  }

  async function scrollHighlightedIntoView() {
    await tick();
    const el = menuEl?.querySelector(`[data-idx="${highlightedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number) {
    if (filtered.length === 0) return;
    let i = highlightedIndex < 0 ? 0 : highlightedIndex;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i]?.disabled) break;
    }
    highlightedIndex = i;
    scrollHighlightedIntoView();
  }

  function onTriggerKeydown(e: KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': e.preventDefault(); highlightedIndex = 0; scrollHighlightedIntoView(); break;
      case 'End': e.preventDefault(); highlightedIndex = filtered.length - 1; scrollHighlightedIntoView(); break;
      case 'Enter':
      case ' ':
        // Space only selects from the trigger; inside the search box it types.
        if (e.key === ' ' && searchable) break;
        e.preventDefault();
        if (filtered[highlightedIndex]) selectOption(filtered[highlightedIndex]);
        break;
      case 'Escape': e.preventDefault(); closeMenu(); triggerEl?.focus(); break;
      case 'Tab': closeMenu(); break;
    }
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Home', 'End', 'Tab'].includes(e.key)) {
      onTriggerKeydown(e);
    }
  }

  function onWindowPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node;
    if (triggerEl?.contains(t)) return;
    if (menuEl?.contains(t)) return;
    closeMenu();
  }

  onDestroy(() => {
    window.removeEventListener('scroll', positionMenu, true);
    window.removeEventListener('resize', positionMenu);
  });
</script>

<svelte:window on:pointerdown={onWindowPointerDown} />

<div class="cps" class:cps--sm={size === 'sm'} class:cps--disabled={disabled}>
  <button
    bind:this={triggerEl}
    type="button"
    class="cps__trigger"
    class:cps__trigger--open={open}
    class:cps__trigger--placeholder={!selectedOption}
    {disabled}
    {id}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    on:click={toggle}
    on:keydown={onTriggerKeydown}
  >
    <span class="cps__value">
      {#if selectedOption}
        {#if selectedOption.icon}<span class="cps__opt-icon">{selectedOption.icon}</span>{/if}
        <span class="cps__value-label">{selectedOption.label}</span>
        {#if selectedOption.badge}<span class="cps__badge">{selectedOption.badge}</span>{/if}
      {:else}
        <span class="cps__value-label">{placeholder}</span>
      {/if}
    </span>
    <svg class="cps__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  {#if open}
    <div
      bind:this={menuEl}
      class="cps__menu"
      class:cps__menu--sm={size === 'sm'}
      style={menuStyle}
      use:portal
      transition:fly={{ y: 6, duration: 140 }}
    >
      {#if searchable}
        <div class="cps__search-wrap">
          <input
            bind:this={searchEl}
            class="cps__search"
            type="text"
            bind:value={search}
            placeholder={searchPlaceholder}
            autocomplete="off"
            spellcheck="false"
            on:input={() => (highlightedIndex = 0)}
            on:keydown={onSearchKeydown}
          />
        </div>
      {/if}

      <div class="cps__options" role="listbox" aria-label={ariaLabel}>
        {#each filtered as opt, i (opt.value)}
          <button
            type="button"
            class="cps__option"
            class:is-active={opt.value === value}
            class:is-highlighted={i === highlightedIndex}
            class:is-disabled={opt.disabled}
            data-idx={i}
            role="option"
            aria-selected={opt.value === value}
            disabled={opt.disabled}
            on:click={() => selectOption(opt)}
            on:mousemove={() => (highlightedIndex = i)}
          >
            {#if opt.icon}<span class="cps__opt-icon">{opt.icon}</span>{/if}
            <span class="cps__option-main">
              <span class="cps__option-label">{opt.label}</span>
              {#if opt.description}<span class="cps__option-desc">{opt.description}</span>{/if}
            </span>
            {#if opt.badge}<span class="cps__badge cps__badge--opt">{opt.badge}</span>{/if}
            <svg class="cps__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        {/each}
        {#if filtered.length === 0}
          <div class="cps__empty">No matches</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .cps {
    position: relative;
    width: 100%;
    font-family: inherit;
  }

  /* ── Trigger ─────────────────────────────────────────────────────────── */
  .cps__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13.5px;
    font-weight: 600;
    color: #0f172a;
    cursor: pointer;
    outline: none;
    text-align: left;
    transition: border-color 0.16s, box-shadow 0.16s, background 0.16s;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    font-family: inherit;
  }
  .cps__trigger:hover:not(:disabled) {
    border-color: #cbd5e1;
    background: #fcfdfe;
  }
  .cps__trigger:focus-visible {
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.14);
  }
  .cps__trigger--open {
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.12);
    background: #fff;
  }
  .cps__trigger--placeholder {
    color: #94a3b8;
    font-weight: 500;
  }
  .cps__trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .cps--sm .cps__trigger {
    padding: 6px 10px;
    font-size: 12.5px;
    border-radius: 8px;
  }

  .cps__value {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    flex: 1;
  }
  .cps__value-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cps__opt-icon {
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
  }

  .cps__badge {
    flex-shrink: 0;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #0d9488;
    background: rgba(2, 182, 188, 0.1);
    border: 1px solid rgba(2, 182, 188, 0.22);
    border-radius: 999px;
    padding: 1px 7px;
    line-height: 1.6;
    white-space: nowrap;
  }

  .cps__chevron {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: #94a3b8;
    transition: transform 0.2s, color 0.2s;
  }
  .cps__trigger--open .cps__chevron {
    transform: rotate(180deg);
    color: #02b6bc;
  }

  /* ── Floating menu (portaled to body, position:fixed) ────────────────── */
  :global(.cps__menu) {
    position: fixed;
    z-index: 99999;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 5px;
    font-family: 'Montserrat', 'Arial', sans-serif;
  }

  :global(.cps__search-wrap) {
    padding: 3px 3px 6px;
  }
  :global(.cps__search) {
    width: 100%;
    box-sizing: border-box;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 7px 11px;
    font-size: 12.5px;
    color: #0f172a;
    outline: none;
    font-family: inherit;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  :global(.cps__search:focus) {
    border-color: #02b6bc;
    box-shadow: 0 0 0 3px rgba(2, 182, 188, 0.1);
  }

  :global(.cps__options) {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(2, 182, 188, 0.25) transparent;
  }
  :global(.cps__options::-webkit-scrollbar) {
    width: 7px;
  }
  :global(.cps__options::-webkit-scrollbar-thumb) {
    background: rgba(2, 182, 188, 0.22);
    border-radius: 7px;
  }

  :global(.cps__option) {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    box-sizing: border-box;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: 13px;
    color: #334155;
    transition: background 0.12s, color 0.12s;
  }
  :global(.cps__option.is-highlighted) {
    background: #f0fdfe;
  }
  :global(.cps__option.is-active) {
    background: rgba(2, 182, 188, 0.1);
    color: #0f766e;
  }
  :global(.cps__option.is-active.is-highlighted) {
    background: rgba(2, 182, 188, 0.16);
  }
  :global(.cps__option.is-disabled) {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :global(.cps__opt-icon) {
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
  }

  :global(.cps__option-main) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  :global(.cps__option-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  :global(.cps__option.is-active .cps__option-label) {
    font-weight: 700;
  }
  :global(.cps__option-desc) {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.cps__badge--opt) {
    margin-left: auto;
  }

  :global(.cps__check) {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    color: #02b6bc;
    opacity: 0;
    transition: opacity 0.12s;
  }
  :global(.cps__option.is-active .cps__check) {
    opacity: 1;
  }
  /* When a badge already pushed itself to the right, the check sits after it. */
  :global(.cps__option:not(.is-active) .cps__check) {
    opacity: 0;
  }

  :global(.cps__empty) {
    padding: 14px 10px;
    text-align: center;
    color: #94a3b8;
    font-size: 12.5px;
  }
</style>
