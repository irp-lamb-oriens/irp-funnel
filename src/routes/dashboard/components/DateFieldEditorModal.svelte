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
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="dfe-overlay" on:click={handleOverlayClick} role="presentation">
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
            <span class="dfe__cell dfe__cell--empty"></span>
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
        <button
          class="dfe__clear-btn"
          type="button"
          on:click={() => (showClearConfirm = true)}
          disabled={!value}
          title={value ? 'Remove this date' : 'Nothing to clear'}
        >Clear date</button>
        <div class="dfe__actions-right">
          <button class="dfe__cancel-btn" type="button" on:click={onClose}>Cancel</button>
          <button class="dfe__confirm-btn" type="button" on:click={confirm} disabled={!hasSelection}>
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
    background: #fff;
    border-radius: 18px;
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
    border-bottom: 1px solid #f1f5f9;
  }
  .dfe__header-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 1px; }
  .dfe__header-text { flex: 1; min-width: 0; }
  .dfe__title {
    font-size: 1.02rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dfe__subtitle { font-size: 0.78rem; color: #64748b; margin: 0; }
  .dfe__close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s;
    &:hover { background: #f1f5f9; }
  }

  /* ── Body ── */
  .dfe__body { padding: 1rem 1.15rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; }

  .dfe__cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .dfe__cal-title { font-size: 0.92rem; font-weight: 700; color: #1e293b; }
  .dfe__nav {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    color: #475569;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    &:hover { border-color: #02b5bb; color: #02b5bb; background: #f0fafa; }
  }

  .dfe__weekdays,
  .dfe__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .dfe__weekday {
    text-align: center;
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #94a3b8;
    padding: 2px 0;
  }
  .dfe__cell {
    aspect-ratio: 1 / 1;
    border: 1.5px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: #334155;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    &:hover:not(.dfe__cell--empty):not(.dfe__cell--selected) { background: #f0fafa; border-color: rgba(2, 181, 187, 0.35); }
  }
  .dfe__cell--empty { cursor: default; }
  .dfe__cell--today { border-color: rgba(2, 181, 187, 0.55); color: #02b5bb; }
  .dfe__cell--selected {
    background: #02b5bb;
    border-color: #02b5bb;
    color: #fff;
    &:hover { background: #019fa4; }
  }

  .dfe__today-link {
    align-self: center;
    background: none;
    border: none;
    color: #02b5bb;
    font-size: 0.76rem;
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
    border-top: 1px solid #f1f5f9;
  }
  .dfe__time-label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .dfe__time-controls { display: flex; align-items: center; gap: 0.4rem; }
  .dfe__select {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.4rem 0.5rem;
    font-size: 0.86rem;
    font-family: inherit;
    color: #1e293b;
    background: #fff;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    &:focus { border-color: #02b5bb; }
  }
  .dfe__time-colon { font-weight: 700; color: #475569; }
  .dfe__ampm { display: flex; gap: 3px; margin-left: 0.2rem; }
  .dfe__ampm-btn {
    border: 1.5px solid #e2e8f0;
    background: #fff;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: inherit;
    padding: 0.4rem 0.65rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    &--active { background: #02b5bb; border-color: #02b5bb; color: #fff; }
  }

  /* ── Preview ── */
  .dfe__preview {
    background: #f0fafa;
    border: 1px solid rgba(2, 181, 187, 0.25);
    border-radius: 10px;
    padding: 0.55rem 0.8rem;
    font-size: 0.84rem;
    font-weight: 600;
    color: #1e293b;
    text-align: center;
    &--empty { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; font-weight: 500; }
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
    color: #dc2626;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    padding: 0.4rem 0.2rem;
    transition: color 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { text-decoration: underline; }
    &:disabled { color: #cbd5e1; cursor: not-allowed; }
  }

  .dfe__cancel-btn {
    padding: 0.5rem 1rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    background: transparent;
    color: #64748b;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover { background: #f8fafc; }
  }

  .dfe__confirm-btn {
    padding: 0.5rem 1.2rem;
    border: none;
    border-radius: 10px;
    background: #02b5bb;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { background: #019fa4; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  /* ── Double-confirm clear ── */
  .dfe__confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 5;
  }
  .dfe__confirm-card {
    background: #fff;
    border-radius: 14px;
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
  .dfe__confirm-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }
  .dfe__confirm-text { font-size: 0.82rem; color: #64748b; margin: 0 0 0.4rem; line-height: 1.4; }
  .dfe__confirm-buttons { display: flex; gap: 0.55rem; }
  .dfe__danger-btn {
    padding: 0.5rem 1.1rem;
    border: none;
    border-radius: 10px;
    background: #dc2626;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover { background: #b91c1c; }
  }
</style>
