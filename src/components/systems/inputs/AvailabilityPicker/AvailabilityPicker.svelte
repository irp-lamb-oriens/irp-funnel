<!--
  AvailabilityPicker.svelte
  ─────────────────────────────────────────────────────────────────────────────
  A fully self-contained availability calendar + slot picker.

  Props
  ─────
  onSelect (required)   Callback fired with the picked ISO string when the user
                        selects a time slot. Called again with "" if the user
                        de-selects.
  preselected           Existing ISO slot to highlight on open (reschedule flow).
  apiBase               Override the API URL. If omitted the component detects
                        localhost vs. production automatically.
  theme                 "dark"  — glass/dark background (hero form)
                        "light" — white card background (CRM dashboard)
  disabled              Disables all interaction while a booking is in-flight.

  Why this component exists separately from Calendar.svelte
  ─────────────────────────────────────────────────────────
  The original Calendar.svelte is tightly coupled to formStore.js via
  `updateField(slots, "scheduling")`. That store only exists in the context of
  the hero booking form. This component has no such dependency — it is purely
  driven by props and fires events, making it safe to embed in the CRM
  dashboard, the status page, or anywhere else.

  Calendar.svelte was updated to delegate to this component while still
  bridging the `onSelect` callback back to `updateField`, so the hero-form
  experience is 100% unchanged.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import TagNode from '../Calendar/TagNode.svelte';
  import { parseBusyEvents, slotConflictsWithBusy } from '../slotConflict.ts';
  import {
    getClientTimezone,
    getTimezoneLabel,
    getTimezoneNotice,
    formatTimeInZone,
  } from '../../../../lib/timezone.ts';


  // ── Props ──────────────────────────────────────────────────────────────────
  /** Called with the selected ISO string (or "" to deselect). */
  export let onSelect: (iso: string) => void;
  /** Pre-selected slot ISO — used in reschedule mode to show the current call. */
  export let preselected: string = '';
  /** API base URL. Auto-detected when not provided. */
  export let apiBase: string = '';
  /** Visual theme: 'dark' (hero form) or 'light' (CRM). */
  export let theme: 'dark' | 'light' = 'light';
  /** Disables interaction while a booking is in-flight. */
  export let disabled: boolean = false;
  /**
   * Controls the colour of unselected time-slot chips.
   *  'dark'  — white text on dark/glass bg (hero form, default — backward-compatible).
   *  'light' — dark (#1e293b) text + teal border on white bg (CRM modal, etc.).
   */
  export let slotTheme: 'dark' | 'light' = 'dark';
  /**
   * When true (staff/dashboard context), reveals a "⚡ Pick a custom time"
   * toggle that lets staff book same-day or off-hours appointments bypassing
   * the 2-day grace and working-hours filter. NEVER set this on the public form.
   */
  export let staffMode: boolean = false;

  // ── Timezone-aware display ────────────────────────────────────────────────
  // Slots are generated in the org timezone (America/Costa_Rica) but the
  // visible labels are rendered in the client's browser timezone. The slot
  // VALUE (ISO instant) never changes — only the label is transformed.
  const clientTz = getClientTimezone();
  const tzNotice = getTimezoneNotice(clientTz);
  const clientTzLabel = getTimezoneLabel(clientTz);

  // ── Staff custom-time state ────────────────────────────────────────────────
  let useCustomTime = false;
  let customTimeValue = '';

  /** Minimum datetime-local value = right now (no grace restriction for staff). */
  $: todayMin = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  })();

  function toggleCustomTime() {
    useCustomTime = !useCustomTime;
    if (!useCustomTime) { customTimeValue = ''; onSelect(''); }
  }

  function handleCustomTimeInput() {
    if (!customTimeValue) { onSelect(''); return; }
    try {
      const d = new Date(customTimeValue);
      if (isNaN(d.getTime())) { onSelect(''); return; }
      onSelect(d.toISOString());
    } catch { onSelect(''); }
  }

  // ── Internal stores ────────────────────────────────────────────────────────
  type AvailableHour = { name: string; value: string; disabled: boolean };
  type Segment = { name: string; children: AvailableHour[] };
  type AvailableDate = { date: string; availableHours: Segment[] };

  const availableDatesStore = writable<AvailableDate[]>([]);
  const errorLoading = writable<string | null>(null);
  const selectedDate = writable<string | null>(null);
  const selectedHoursStore = writable<string[]>([]);
  const selectedSegment = writable<string | null>(null);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let calendarDays: { date: string; isAvailable: boolean }[] = [];
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let emptyStartCells = 0;

  // ── API base detection ─────────────────────────────────────────────────────
  function resolveApiBase(): string {
    if (apiBase) return apiBase;
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
    return 'https://irp-funnel-server.onrender.com';
  }

  // ── Calendar grid helpers ──────────────────────────────────────────────────
  function updateCalendar() {
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    emptyStartCells = firstDayOfMonth.getUTCDay();
    calendarDays = [];
    const availableDates = get(availableDatesStore);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(currentYear, currentMonth, day));
      const fmt = d.toISOString().split('T')[0];
      const dow = d.getUTCDay();
      const isBlocked = dow === 0 || dow === 5 || dow === 6;  // Sun / Fri / Sat
      calendarDays.push({ date: fmt, isAvailable: !isBlocked && !!availableDates.find(a => a.date === fmt) });
    }
    // Svelte reactive reassignment
    calendarDays = [...calendarDays];
  }

  availableDatesStore.subscribe(dates => { if (dates.length > 0) updateCalendar(); });

  function nextMonth() {
    currentMonth = (currentMonth + 1) % 12;
    if (currentMonth === 0) currentYear++;
    updateCalendar();
  }

  function previousMonth() {
    currentMonth = (currentMonth - 1 + 12) % 12;
    if (currentMonth === 11) currentYear--;
    updateCalendar();
  }

  // ── Slot selection ─────────────────────────────────────────────────────────
  function selectDate(date: string, isAvailable: boolean) {
    if (!isAvailable || disabled) return;
    const current = get(selectedDate);
    if (current === date) {
      selectedDate.set(null);
      selectedHoursStore.set([]);
      selectedSegment.set(null);
      onSelect('');
    } else {
      selectedDate.set(date);
      selectedHoursStore.set([]);
      selectedSegment.set(null);
      onSelect('');  // clear any previously picked hour when date changes
    }
  }

  function toggleHour(hour: string) {
    if (disabled) return;
    selectedHoursStore.update(hours => {
      const idx = hours.indexOf(hour);
      const next = idx > -1 ? [] : [hour];
      onSelect(next[0] ?? '');
      return next;
    });
  }

  // ── Availability loading ───────────────────────────────────────────────────
  function convertToCST(date: Date): Date {
    const offset = -6 * 60;
    return new Date(date.getTime() + offset * 60 * 1000);
  }

  function getStartDate(): Date {
    let date = convertToCST(new Date());
    // CRM staff bypass the 2-working-day grace period entirely: the calendar
    // grid starts from TODAY so operators can book same-day / next-day calls.
    // The public hero form leaves staffMode=false, so the grace period below
    // still applies to self-scheduling clients — behaviour is unchanged there.
    if (staffMode) return date;
    let workingDaysToAdd = 2;
    while (workingDaysToAdd > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      const dow = date.getUTCDay();
      if (dow !== 0 && dow !== 5 && dow !== 6) workingDaysToAdd--;
    }
    return date;
  }


  async function loadAvailableDates() {
    try {
      const base = resolveApiBase();
      const response = await fetch(`${base}/api/events`);
      if (!response.ok) throw new Error('Failed to fetch events');
      const events = await response.json();
      const busyEvents = parseBusyEvents(events);


      const datesWithHours: Record<string, Segment[]> = {};
      const startOfDay = getStartDate();
      const maxDate = convertToCST(new Date());
      maxDate.setUTCDate(maxDate.getUTCDate() + 14);

      for (let d = new Date(startOfDay); d <= maxDate; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === 0 || d.getUTCDay() === 5 || d.getUTCDay() === 6) continue;
        const dateKey = d.toISOString().split('T')[0];
        datesWithHours[dateKey] = [
          { name: 'Morning', children: [] },
          { name: 'Afternoon', children: [] },
          { name: 'Evening', children: [] },
        ];
        for (let hour = 9; hour <= 16; hour++) {
          const t = new Date(d);
          t.setUTCHours(hour + 6, 0, 0, 0);
          const slotMs = t.getTime();
          // Unavailable if it overlaps an event OR sits within the 30-min
          // inter-call buffer of one — same rule as the backend (slotConflict.ts).
          const isBusy = slotConflictsWithBusy(slotMs, busyEvents);

          const timeString = formatTimeInZone(t, clientTz);
          const slot: AvailableHour = { name: timeString, value: t.toISOString(), disabled: isBusy };
          if (hour < 12) datesWithHours[dateKey][0].children.push(slot);
          else if (hour < 17) datesWithHours[dateKey][1].children.push(slot);
          else datesWithHours[dateKey][2].children.push(slot);
        }
      }

      const formattedDates: AvailableDate[] = Object.entries(datesWithHours).map(([date, segs]) => ({
        date,
        availableHours: segs.filter(s => s.children.length > 0),
      }));
      availableDatesStore.set(formattedDates);

      // If a preselected slot was provided, activate its date and segment
      if (preselected) {
        const preDate = preselected.split('T')[0];
        const matchDate = formattedDates.find(d => d.date === preDate);
        if (matchDate) {
          selectedDate.set(preDate);
          selectedHoursStore.set([preselected]);
          // Activate the correct segment
          for (const seg of matchDate.availableHours) {
            if (seg.children.some(c => c.value === preselected)) {
              selectedSegment.set(seg.name);
              break;
            }
          }
        }
      }
    } catch (err: any) {
      errorLoading.set('Failed to load available dates. Please try again later.');
    }
  }

  onMount(loadAvailableDates);

  // Reactive helpers for template
  $: currentDates = $availableDatesStore;
  $: selectedDateSlots = $selectedDate
    ? (currentDates.find(d => d.date === $selectedDate)?.availableHours ?? [])
    : [];
  $: currentSegmentSlots = $selectedSegment
    ? (selectedDateSlots.find(s => s.name === $selectedSegment)?.children ?? [])
    : [];
</script>

<div class="ap ap--{theme}" class:ap--disabled={disabled}>
  {#if tzNotice}
    <div class="ap__tz-notice" role="status">
      <span class="ap__tz-dot" aria-hidden="true"></span>
      <span>Times shown in {clientTzLabel} ({tzNotice})</span>
    </div>
  {/if}

  {#if staffMode}
    <div class="ap__staff-bar">
      <button type="button" class="ap__staff-toggle" on:click={toggleCustomTime}>
        {useCustomTime ? '← Use calendar slots' : '⚡ Pick a custom time'}
      </button>
    </div>
  {/if}

  {#if staffMode && useCustomTime}
    <div class="ap__custom-time">
      <label class="ap__custom-label" for="ap-custom-input">Date &amp; time (your local time)</label>
      <input
        id="ap-custom-input"
        type="datetime-local"
        class="ap__custom-input"
        bind:value={customTimeValue}
        min={todayMin}
        on:input={handleCustomTimeInput}
        disabled={disabled}
      />
      {#if customTimeValue}
        <p class="ap__custom-preview">
          ✓ {new Date(customTimeValue).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
          })} (CR time)
        </p>
      {/if}
    </div>
  {:else if $errorLoading}
    <div class="ap__error">{$errorLoading}</div>
  {:else if currentDates.length === 0}
    <div class="ap__loading">
      <span class="ap__spinner"></span>
      Loading availability…
    </div>
  {:else}
    <!-- Month navigation -->
    <div class="ap__header">
      <button class="ap__nav" on:click={previousMonth} disabled={disabled} type="button">&lt;</button>
      <span class="ap__month-label">
        {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
      </span>
      <button class="ap__nav" on:click={nextMonth} disabled={disabled} type="button">&gt;</button>
    </div>

    <!-- Weekday labels -->
    <div class="ap__weekdays">
      {#each weekDays as day}<div class="ap__weekday">{day}</div>{/each}
    </div>

    <!-- Calendar grid -->
    <div class="ap__grid">
      {#each Array(emptyStartCells) as _}<div class="ap__cell ap__cell--empty"></div>{/each}
      {#each calendarDays as day}
        <button
          type="button"
          class="ap__cell ap__day"
          class:ap__day--available={day.isAvailable}
          class:ap__day--selected={$selectedDate === day.date}
          disabled={!day.isAvailable || disabled}
          on:click={() => selectDate(day.date, day.isAvailable)}
        >
          {parseInt(day.date.split('-')[2])}
        </button>
      {/each}
    </div>

    <!-- Time slot sidebar -->
    {#if $selectedDate}
      <div class="ap__slots">
        <p class="ap__slots-title">Available times — {$selectedDate}</p>

        <!-- AM / PM / Evening segments -->
        <div class="ap__segments">
          {#each selectedDateSlots as segment}
            <button
              type="button"
              class="ap__segment"
              class:ap__segment--active={$selectedSegment === segment.name}
              disabled={disabled}
              on:click={() => selectedSegment.set(segment.name)}
            >{segment.name}</button>
          {/each}
        </div>

        <!-- Individual slot chips -->
        {#if $selectedSegment}
          <div class="ap__chips">
            {#each currentSegmentSlots as hour}
              <TagNode node={hour} selectedTags={selectedHoursStore} toggleTag={toggleHour} slotTheme={slotTheme} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  /* ── Base ── */
  .ap {
    --ap-bg:        #fff;
    --ap-border:    rgba(2, 181, 187, 0.2);
    --ap-text:      #1e293b;
    --ap-muted:     #64748b;
    --ap-day-hover: rgba(2, 181, 187, 0.08);
    --ap-accent:    #02b5bb;
    --ap-nav-bg:    #f1f5f9;
    --ap-avail-bg:  rgba(2, 181, 187, 0.06);
    --ap-avail-bdr: rgba(2, 181, 187, 0.25);
    --ap-sel-bg:    #02b5bb;
    --ap-sel-text:  #fff;
    --ap-disabled:  rgba(0, 0, 0, 0.15);

    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 360px;
    background: var(--ap-bg);
    border: 1px solid var(--ap-border);
    border-radius: 14px;
    box-shadow: 0 2px 12px rgba(2, 181, 187, 0.06);
    padding: 1.25rem;
    color: var(--ap-text);
    font-family: inherit;

    &--dark {
      --ap-bg:        rgba(255, 255, 255, 0.03);
      --ap-border:    rgba(255, 255, 255, 0.08);
      --ap-text:      #fff;
      --ap-muted:     rgba(255, 255, 255, 0.5);
      --ap-day-hover: rgba(255, 255, 255, 0.1);
      --ap-accent:    var(--color-highlight-2, #02b5bb);
      --ap-nav-bg:    rgba(255, 255, 255, 0.05);
      --ap-avail-bg:  rgba(255, 255, 255, 0.05);
      --ap-avail-bdr: rgba(255, 255, 255, 0.1);
      --ap-sel-bg:    var(--color-highlight-2, #02b5bb);
      --ap-sel-text:  #000;
      --ap-disabled:  rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
    }

    &--disabled { opacity: 0.6; pointer-events: none; }
  }

  .ap__error {
    color: #ef4444;
    font-weight: 500;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.08);
    border-radius: 8px;
    text-align: center;
    font-size: 0.85rem;
  }

  .ap__tz-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.85rem;
    border-radius: 8px;
    background: var(--ap-avail-bg);
    border: 1px solid var(--ap-avail-bdr);
    color: var(--ap-muted);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .ap__tz-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ap-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ap-accent) 18%, transparent);
  }

  .ap__loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    color: var(--ap-muted);
    font-size: 0.85rem;
    padding: 1.5rem 0;
  }

  .ap__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--ap-border);
    border-top-color: var(--ap-accent);
    border-radius: 50%;
    animation: ap-spin 0.7s linear infinite;
  }

  /* ── Header ── */
  .ap__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .ap__month-label {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--ap-text);
  }

  .ap__nav {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--ap-nav-bg);
    border: 1px solid var(--ap-border);
    color: var(--ap-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: var(--ap-day-hover); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  /* ── Grid ── */
  .ap__weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--ap-muted);
    margin-bottom: 0.5rem;
    gap: 2px;
  }

  .ap__weekday { padding: 2px 0; }

  .ap__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    text-align: center;
  }

  .ap__cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 500;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ap-disabled);
    cursor: not-allowed;
    transition: all 0.15s;

    &--empty { visibility: hidden; }
  }

  .ap__day {
    color: var(--ap-text);
    opacity: 0.25;

    &--available {
      opacity: 1;
      background: var(--ap-avail-bg);
      border-color: var(--ap-avail-bdr);
      cursor: pointer;
      &:hover:not(:disabled) {
        background: var(--ap-day-hover);
        border-color: var(--ap-accent);
      }
    }

    &--selected {
      background: var(--ap-sel-bg) !important;
      color: var(--ap-sel-text) !important;
      border-color: var(--ap-sel-bg) !important;
      opacity: 1;
      font-weight: 700;
    }

    &:disabled { pointer-events: none; }
  }

  /* ── Slots ── */
  .ap__slots {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--ap-border);
  }

  .ap__slots-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ap-muted);
    margin: 0 0 0.75rem;
  }

  .ap__segments {
    display: flex;
    gap: 0.4rem;
    background: var(--ap-nav-bg);
    border-radius: 8px;
    padding: 3px;
    margin-bottom: 0.75rem;
  }

  .ap__segment {
    flex: 1;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ap-muted);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    &--active {
      background: var(--ap-bg);
      border-color: var(--ap-border);
      color: var(--ap-text);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    &:hover:not(:disabled):not(.ap__segment--active) { color: var(--ap-text); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  .ap__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  @keyframes ap-spin { to { transform: rotate(360deg); } }

  /* ── Staff-mode custom time picker ── */
  .ap__staff-bar {
    padding: 0 0 0.75rem;
    display: flex;
  }
  .ap__staff-toggle {
    background: none;
    border: 1px dashed var(--ap-avail-bdr);
    color: var(--ap-muted);
    border-radius: 8px;
    padding: 0.3rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    &:hover:not(:disabled) {
      border-style: solid;
      border-color: var(--ap-accent);
      color: var(--ap-accent);
      background: var(--ap-avail-bg);
    }
  }
  .ap__custom-time {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.25rem 0 0.5rem;
  }
  .ap__custom-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ap-muted);
  }
  .ap__custom-input {
    background: var(--ap-bg);
    border: 1.5px solid var(--ap-avail-bdr);
    border-radius: 8px;
    color: var(--ap-text);
    padding: 0.5rem 0.65rem;
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s;
    &:focus { border-color: var(--ap-accent); }
    &:disabled { opacity: 0.5; }
  }
  .ap__custom-preview {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ap-accent);
    margin: 0;
  }
</style>
