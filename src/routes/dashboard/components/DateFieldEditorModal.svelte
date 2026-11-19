<!--
  DateFieldEditorModal.svelte
  ──────────────────────────────────────────────────────────────────────────────
  A reusable, beautiful date (+ optional time) picker modal for editing
  `date` / `datetime` fields anywhere in the dashboard.

  It shares the visual language of ScheduleCallModal (overlay + blur, teal
  #02b5bb accent, slate typography, rounded card) so date editing feels like a
  first-class flow — NOT a bare browser input.

  Design goals
  ────────────
    • Month-grid calendar with prev/next navigation, today outline, selected fill.
    • Optional time picker (hour / minute / AM-PM) when `withTime` is true.
    • "Clear date" flows through a graceful double-confirmation so an operator
      never nukes a date by accident.
    • Emits ONE thing on commit: the next value string.
        - `date`     → "YYYY-MM-DD"  (no timezone shift)
        - `datetime` → full ISO string (`Date.toISOString()`)
        - cleared    → "" (empty string, i.e. unset)

  Props
  ─────
    label     Human field label (shown in header + clear confirmation).
    value     Current value string (ISO / "YYYY-MM-DD" / "" — best-effort parsed).
    withTime  Show the time picker + emit a full ISO datetime.
    onClose() Dismiss without saving.
    onCommit(next) Called with the new value string (or "" to unset).
-->
<script lang="ts">
  import { onMount } from 'svelte';

  export let label: string = 'Date';
  export let value: string = '';
  export let withTime: boolean = false;
  export let onClose: () => void = () => {};
  export let onCommit: (next: string) => void = () => {};
  /**
   * When false, the in-modal "Clear date" affordance (and its double-confirm)
   * is hidden — used when the caller owns its own delete control (e.g. the
   * ✕ on <DateFieldRow>), so date removal lives in exactly one place.
   */
  export let allowClear: boolean = true;


  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const BASE_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // ── Parse the incoming value into a Date (best-effort) ──────────────────────
  function parseInitial(v: string): Date | null {
    if (!v || typeof v !== 'string') return null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    // date-only "YYYY-MM-DD" → construct in LOCAL time to avoid a UTC day-shift.
    const dOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dOnly) {
      return new Date(Number(dOnly[1]), Number(dOnly[2]) - 1, Number(dOnly[3]));
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const initial = parseInitial(value);
  const today = new Date();

  // Selection (null until the operator has a concrete day chosen)
  let selYear: number | null = initial ? initial.getFullYear() : null;
  let selMonth: number | null = initial ? initial.getMonth() : null; // 0-based
  let selDay: number | null = initial ? initial.getDate() : null;

  // Calendar page currently shown
  let viewYear = initial ? initial.getFullYear() : today.getFullYear();
  let viewMonth = initial ? initial.getMonth() : today.getMonth();

  // Time state (12-hour UI, converted to 24h on commit)
  const initHour24 = initial ? initial.getHours() : 9;
  let minute = initial ? initial.getMinutes() : 0;
  let ampm: 'AM' | 'PM' = initHour24 >= 12 ? 'PM' : 'AM';
  let hour12 = ((initHour24 + 11) % 12) + 1;

  let showClearConfirm = false;

  $: hasSelection = selYear !== null && selMonth !== null && selDay !== null;
  // Keep the operator's original odd minute value selectable (e.g. :37).
  $: minuteOptions = Array.from(new Set([...BASE_MINUTES, minute])).sort((a, b) => a - b);

  function daysInMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate();
  }
  function firstWeekday(y: number, m: number): number {
    return new Date(y, m, 1).getDay(); // 0 = Sunday
  }

  $: gridDays = buildGrid(viewYear, viewMonth);
  function buildGrid(y: number, m: number): Array<number | null> {
    const lead = firstWeekday(y, m);
    const total = daysInMonth(y, m);
    const cells: Array<number | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() {
    if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; } else { viewMonth -= 1; }
  }
  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear += 1; } else { viewMonth += 1; }
  }
  function selectDay(d: number) {
    selYear = viewYear;
    selMonth = viewMonth;
    selDay = d;
  }
  function jumpToday() {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectDay(today.getDate());
  }

  function isToday(d: number): boolean {
    return d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  }
  function isSelected(d: number): boolean {
    return hasSelection && d === selDay && viewMonth === selMonth && viewYear === selYear;
  }

  function pad(n: number): string { return String(n).padStart(2, '0'); }
  function to24(): number {
    let h = hour12 % 12;
    if (ampm === 'PM') h += 12;
    return h;
  }

  $: previewLabel = buildPreview(hasSelection, selYear, selMonth, selDay, withTime, hour12, minute, ampm);
  function buildPreview(
    has: boolean, y: number | null, m: number | null, d: number | null,
    wt: boolean, _h: number, _min: number, _ap: 'AM' | 'PM',
  ): string {
    if (!has) return 'No date selected';
    const base = new Date(y!, m!, d!).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    return wt ? `${base} · ${hour12}:${pad(minute)} ${ampm}` : base;
  }

  function confirm() {
    if (!hasSelection) { onCommit(''); return; }
    if (withTime) {
      const d = new Date(selYear!, selMonth!, selDay!, to24(), minute, 0, 0);
      onCommit(d.toISOString());
    } else {
      onCommit(`${selYear}-${pad(selMonth! + 1)}-${pad(selDay!)}`);
    }
  }

  function doClear() {
    showClearConfirm = false;
    onCommit('');
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('dfe-overlay')) onClose();
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showClearConfirm) showClearConfirm = false;
      else onClose();
    }
  }

  /**
   * Move the overlay onto <body> so it can't be trapped/clipped by an ancestor
   * that establishes a containing block for `position: fixed`. The Detail Panel
   * (`.detail-panel`) has BOTH a `transform` (its slide-in animation) and
   * `overflow-y: auto` — per spec a transformed ancestor becomes the containing
   * block for fixed descendants, so without this portal the overlay is
   * positioned + clipped relative to the panel and visibly "shakes" to the
   * correct full-viewport position on the next repaint (e.g. on mouse-move).
   * Mirrors the same portal pattern used by <Select> and <MentionTextarea>.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }
  onMount(() => {

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="dfe-overlay" use:portal on:click={handleOverlayClick} role="presentation">

  <div class="dfe" role="dialog" aria-modal="true" aria-label={`Edit ${label}`}>
    <!-- Header -->
    <div class="dfe__header">
      <div class="dfe__header-icon">📅</div>
      <div class="dfe__header-text">
        <h2 class="dfe__title">{label}</h2>
        <p class="dfe__subtitle">{withTime ? 'Pick a date & time' : 'Pick a date'}</p>
      </div>
      <button class="dfe__close" type="button" on:click={onClose} aria-label="Close">✕</button>
    </div>

    <div class="dfe__body">
      <!-- Month navigation -->
      <div class="dfe__cal-head">
        <button class="dfe__nav" type="button" on:click={prevMonth} aria-label="Previous month">‹</button>
        <span class="dfe__cal-title">{MONTHS[viewMonth]} {viewYear}</span>
        <button class="dfe__nav" type="button" on:click={nextMonth} aria-label="Next month">›</button>
      </div>

      <!-- Weekday header -->
      <div class="dfe__weekdays">
        {#each WEEKDAYS as wd}<span class="dfe__weekday">{wd}</span>{/each}
      </div>

      <!-- Day grid -->
      <div class="dfe__grid">
        {#each gridDays as d, i (i)}
          {#if d === null}
            <span class="dfe__cell dfe__cell--empty" role="status"></span>
          {:else}
            <button
              type="button"
              class="dfe__cell"
              class:dfe__cell--today={isToday(d)}
              class:dfe__cell--selected={isSelected(d)}
              on:click={() => selectDay(d)}
            >{d}</button>
          {/if}
        {/each}
      </div>

      <button class="dfe__today-link" type="button" on:click={jumpToday}>Jump to today</button>

      <!-- Optional time picker -->
      {#if withTime}
        <div class="dfe__time">
          <span class="dfe__time-label">Time</span>
          <div class="dfe__time-controls">
            <select class="dfe__select" bind:value={hour12} aria-label="Hour">
              {#each HOURS12 as h}<option value={h}>{h}</option>{/each}
            </select>
            <span class="dfe__time-colon">:</span>
            <select class="dfe__select" bind:value={minute} aria-label="Minute">
              {#each minuteOptions as mm}<option value={mm}>{pad(mm)}</option>{/each}
            </select>
            <div class="dfe__ampm">
              <button
                type="button"
                class="dfe__ampm-btn"
                class:dfe__ampm-btn--active={ampm === 'AM'}
                on:click={() => (ampm = 'AM')}
              >AM</button>
              <button
                type="button"
                class="dfe__ampm-btn"
                class:dfe__ampm-btn--active={ampm === 'PM'}
                on:click={() => (ampm = 'PM')}
              >PM</button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Live preview -->
      <div class="dfe__preview" class:dfe__preview--empty={!hasSelection}>{previewLabel}</div>

      <!-- Actions -->
      <div class="dfe__actions">
        {#if allowClear}
          <button
            class="dfe__clear-btn"
            type="button"
            on:click={() => (showClearConfirm = true)}
            disabled={!value}
            title={value ? 'Remove this date' : 'Nothing to clear'}
          >Clear date</button>
        {/if}
        <div class="dfe__actions-right">

          <button class="dfe__cancel-btn" type="button" on:click={onClose}>Cancel</button>
          <button class="dfe__confirm-btn" type="button" on:click={confirm} disabled={!hasSelection} title={!hasSelection ? 'Pick a date first' : undefined}>
            ✓ Confirm
          </button>
        </div>
      </div>
    </div>

    <!-- Double-confirm clear -->
    {#if showClearConfirm}
      <div class="dfe__confirm-overlay" role="presentation">
        <div class="dfe__confirm-card" role="alertdialog" aria-modal="true" aria-label="Confirm clear date">
          <div class="dfe__confirm-icon">🗑️</div>
          <h3 class="dfe__confirm-title">Remove this date?</h3>
          <p class="dfe__confirm-text">
            This will unset <strong>{label}</strong>. You can set it again anytime.
          </p>
          <div class="dfe__confirm-buttons">
            <button class="dfe__cancel-btn" type="button" on:click={() => (showClearConfirm = false)}>
              Keep it
            </button>
            <button class="dfe__danger-btn" type="button" on:click={doClear}>Yes, remove</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .dfe-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    z-index: 2100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .dfe {
    position: relative;
    background: var(--irp-surface);
    border-radius: var(--irp-r-xl);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
    width: 100%;
    max-width: 380px;
    max-height: 92vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .dfe__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.1rem 1.15rem 0.9rem;
    border-bottom: 1px solid var(--irp-slate-100);
  }
  .dfe__header-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 1px; }
  .dfe__header-text { flex: 1; min-width: 0; }
  .dfe__title {
    font-size: var(--irp-fs-lg);
    font-weight: 700;
    color: var(--irp-text);
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dfe__subtitle { /* shared anatomy */ margin: 0.3rem 0 0; max-width: 68ch; font-size: var(--irp-fs-sm); font-weight: 400; line-height: 1.5; color: var(--irp-text-muted); text-transform: none; letter-spacing: 0; margin: 0; }
  .dfe__close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--irp-line);
    background: transparent;
    color: var(--irp-text-dim);
    cursor: pointer;
    font-size: var(--irp-fs-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s;
    &:hover { background: var(--irp-surface-3); }
  }

  /* ── Body ── */
  .dfe__body { padding: 1rem 1.15rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; }

  .dfe__cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .dfe__cal-title { font-size: var(--irp-fs-md); font-weight: 700; color: var(--irp-text); }
  .dfe__nav {
    width: 30px;
    height: 30px;
    border-radius: var(--irp-r-sm);
    border: 1.5px solid var(--irp-line);
    background: var(--irp-surface);
    color: var(--irp-text-muted);
    font-size: var(--irp-fs-xl);
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    &:hover { border-color: var(--irp-accent); color: var(--irp-accent-ink); background: var(--irp-surface-2); }
  }

  .dfe__weekdays,
  .dfe__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .dfe__weekday {
    text-align: center;
    font-size: var(--irp-fs-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--irp-text-dim);
    padding: 2px 0;
  }
  .dfe__cell {
    aspect-ratio: 1 / 1;
    border: 1.5px solid transparent;
    border-radius: var(--irp-r-md);
    background: transparent;
    color: var(--irp-text-2);
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    &:hover:not(.dfe__cell--empty):not(.dfe__cell--selected) { background: var(--irp-surface-2); border-color: rgba(2, 181, 187, 0.35); }
  }
  .dfe__cell--empty { cursor: default; }
  .dfe__cell--today { border-color: rgba(2, 181, 187, 0.55); color: var(--irp-accent-ink); }
  .dfe__cell--selected {
    background: var(--irp-accent);
    border-color: var(--irp-accent);
    color: var(--irp-text-inverse);
    &:hover { background: var(--irp-accent-hover); }
  }

  .dfe__today-link {
    align-self: center;
    background: none;
    border: none;
    color: var(--irp-accent-ink);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    padding: 0.1rem 0.4rem;
    &:hover { text-decoration: underline; }
  }

  /* ── Time ── */
  .dfe__time {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--irp-slate-100);
  }
  .dfe__time-label { font-size: var(--irp-fs-xs); font-weight: 600; color: var(--irp-text-muted); }
  .dfe__time-controls { display: flex; align-items: center; gap: 0.4rem; }
  .dfe__select {
    border: 1.5px solid var(--irp-line);
    border-radius: var(--irp-r-sm);
    padding: 0.4rem 0.5rem;
    font-size: var(--irp-fs-md);
    font-family: inherit;
    color: var(--irp-text);
    background: var(--irp-surface);
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    &:focus { border-color: var(--irp-accent); }
  }
  .dfe__time-colon { font-weight: 700; color: var(--irp-text-muted); }
  .dfe__ampm { display: flex; gap: 3px; margin-left: 0.2rem; }
  .dfe__ampm-btn {
    border: 1.5px solid var(--irp-line);
    background: var(--irp-surface);
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    font-family: inherit;
    padding: 0.4rem 0.65rem;
    border-radius: var(--irp-r-sm);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    &--active { background: var(--irp-accent); border-color: var(--irp-accent); color: var(--irp-text-inverse); }
  }

  /* ── Preview ── */
  .dfe__preview {
    background: var(--irp-surface-2);
    border: 1px solid rgba(2, 181, 187, 0.25);
    border-radius: var(--irp-r-md);
    padding: 0.55rem 0.8rem;
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    color: var(--irp-text);
    text-align: center;
    &--empty { background: var(--irp-surface-2); border-color: var(--irp-line); color: var(--irp-text-dim); font-weight: 500; }
  }

  /* ── Actions ── */
  .dfe__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.2rem;
  }
  .dfe__actions-right { display: flex; gap: 0.55rem; }

  .dfe__clear-btn {
    background: none;
    border: none;
    color: var(--irp-red-600);
    font-size: var(--irp-fs-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    padding: 0.4rem 0.2rem;
    transition: color 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { text-decoration: underline; }
    &:disabled { color: var(--irp-text-dim); cursor: not-allowed; }
  }

  .dfe__cancel-btn {
    padding: 0.5rem 1rem;
    border: 1.5px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    background: transparent;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-md);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover { background: var(--irp-surface-2); }
  }

  .dfe__confirm-btn {
    padding: 0.5rem 1.2rem;
    border: none;
    border-radius: var(--irp-r-md);
    background: var(--irp-accent);
    color: var(--irp-text-inverse);
    font-size: var(--irp-fs-md);
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { background: var(--irp-accent-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  /* ── Double-confirm clear ── */
  .dfe__confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
    border-radius: var(--irp-r-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 5;
  }
  .dfe__confirm-card {
    background: var(--irp-surface);
    border-radius: var(--irp-r-lg);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
    padding: 1.3rem 1.25rem;
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }
  .dfe__confirm-icon { font-size: 1.8rem; }
  .dfe__confirm-title { font-size: var(--irp-fs-lg); font-weight: 700; color: var(--irp-text); margin: 0; }
  .dfe__confirm-text { font-size: var(--irp-fs-sm); color: var(--irp-text-dim); margin: 0 0 0.4rem; line-height: 1.4; }
  .dfe__confirm-buttons { display: flex; gap: 0.55rem; }
  .dfe__danger-btn {
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: var(--irp-r-md);
    background: var(--irp-red-600);
    color: var(--irp-text-inverse);
    font-size: var(--irp-fs-md);
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover { background: var(--irp-red-700); }
  }
</style>
