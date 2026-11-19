<!--
  ScheduleCallModal.svelte
  ──────────────────────────────────────────────────────────────────────────────
  Unified modal for two flows:

  "reschedule" — An existing client card. Shows the current call slot (if any),
    lets the operator pick a new one from the AvailabilityPicker, and calls
    POST /api/dashboard/clients/:id/reschedule.

  "create" — No existing client. Shows a compact client-info form + the
    AvailabilityPicker (optional — the call can be deferred), and calls
    POST /api/dashboard/clients.

  Both flows write a typed activityLog entry on the server side tracking
  WHO (actor = staff email), WHERE (source: crm_dashboard), and WHEN
  (timestamp from the server). The frontend shows a success state with
  the Google Meet link when available.

  Props
  ─────
    mode        'reschedule' | 'create'
    client      The ClientRecord (reschedule mode). Null in create mode.
    onClose()   Called when the modal should be dismissed.
    onSuccess(result) Called after a successful booking/creation with the server response.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { rescheduleCall, createClientFromCrm, addAttendeesToCall } from '../store.ts';
  import { toasts } from '../toastStore.ts';
  import AvailabilityPicker from '../../../components/systems/inputs/AvailabilityPicker/AvailabilityPicker.svelte';

  export let mode: 'reschedule' | 'create';
  export let client: any = null;
  export let onClose: () => void;
  export let onSuccess: (result: any) => void = () => {};

  // ── State ──────────────────────────────────────────────────────────────────
  let selectedSlot = '';
  let submitting = false;
  let successResult: any = null;
  // True when a reschedule-mode submit only ADDED attendees (no time change).
  // Drives the success copy so it reads "Invite Sent!" instead of "Rescheduled".
  let attendeeOnly = false;


  // Create-mode form fields
  let email = '';
  let firstName = '';
  let lastName = '';
  let phone = '';
  let destinationCountry = '';
  let originCountry = '';
  let notes = '';

  // ── Attendees ────────────────────────────────────────────────────────────
  // Create mode: primary lead = email (the form field above); extraAttendees
  // are added to the Calendar invite and deduped server-side.
  // Reschedule mode: extra invitees only (primary is the existing client).
  let extraAttendees: string[] = [];

  function addAttendee()             { extraAttendees = [...extraAttendees, '']; }
  function removeAttendee(i: number) { extraAttendees = extraAttendees.filter((_, idx) => idx !== i); }
  /** Swap attendee at index i with the primary email field. */
  function promoteAttendee(i: number) {
    const newPrimary = extraAttendees[i]?.trim();
    if (!newPrimary) return;
    const oldPrimary = email;
    email = newPrimary;
    extraAttendees = extraAttendees.map((a, idx) => idx === i ? oldPrimary : a);
    extraAttendees = [...extraAttendees];
  }

  // Current slot for reschedule mode (source of truth for "did the time change?")
  $: currentSlot = client?.scheduling?.[0] ?? client?.lastCalendarEvent?.startTime ?? '';
  $: currentSlotLabel = currentSlot
    ? new Date(currentSlot).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
      }) + ' (CR time)'
    : 'No call scheduled';

  // ── Reschedule vs. add-attendee intent ─────────────────────────────────────
  // The picker highlights the current slot on open but never fires onSelect for
  // it, so we seed `selectedSlot = currentSlot` on mount. `slotChanged` is true
  // only once the operator picks a genuinely different time (>60s away), which
  // is what distinguishes a real reschedule from an attendee-only update.
  $: slotChanged = (() => {
    if (mode !== 'reschedule' || !selectedSlot) return false;
    if (!currentSlot) return true; // no existing slot → any pick is a (re)schedule
    const a = new Date(selectedSlot).getTime();
    const b = new Date(currentSlot).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return selectedSlot !== currentSlot;
    return Math.abs(a - b) > 60_000;
  })();

  // People already invited to this call (persisted extras on the latest
  // consultation entry). Shown as read-only chips so staff don't re-add them.
  $: alreadyInvited = (() => {
    const cons = client?.rawDoc?.consultations;
    if (!Array.isArray(cons) || cons.length === 0) return [] as string[];
    const last = cons[cons.length - 1];
    const extra = Array.isArray(last?.additionalAttendees) ? last.additionalAttendees : [];
    return extra.filter((e: any) => typeof e === 'string' && e.includes('@')) as string[];
  })();
  $: alreadyInvitedSet = new Set(alreadyInvited.map((e) => e.toLowerCase()));
  // Valid, de-duplicated new invitees the operator typed (excluding people
  // already on the call).
  $: newAttendeeEmails = extraAttendees
    .map((e) => e.trim())
    .filter((e) => e.includes('@'))
    .filter((e) => !alreadyInvitedSet.has(e.toLowerCase()));
  $: hasNewAttendees = newAttendeeEmails.length > 0;

  // Validation — reschedule mode can submit EITHER a genuine time change OR an
  // attendee-only addition; create mode still just needs a valid email.
  $: emailValid = email.includes('@') && email.includes('.');
  $: canSubmit = !submitting && (
    mode === 'reschedule'
      ? (slotChanged || hasNewAttendees)
      : emailValid
  );


  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return;
    submitting = true;
    try {
      if (mode === 'reschedule' && client) {
        if (slotChanged) {
          // A genuine time change → full reschedule (also carries any new invitees).
          attendeeOnly = false;
          const extras = extraAttendees.map((e) => e.trim()).filter((e) => e.includes('@'));
          const result = await rescheduleCall(client.id, selectedSlot, extras.length ? extras : undefined);
          successResult = result;
          toasts.success('Call rescheduled! Google Meet link is ready.');
          onSuccess(result);
        } else {
          // Time unchanged → just add the new attendee(s) to the existing call.
          attendeeOnly = true;
          const result = await addAttendeesToCall(client.id, newAttendeeEmails);
          successResult = result;
          toasts.success(
            result.alreadyPresent
              ? 'Those attendees were already invited.'
              : 'Invite sent to the new attendee(s)!',
          );
          onSuccess(result);
        }
      } else {

        const extras = extraAttendees.filter((e: string) => e.trim()).map((e: string) => e.trim());
        const result = await createClientFromCrm({
          email: email.trim(),
          name: firstName.trim(),
          surname: lastName.trim(),
          phone: phone.trim(),
          destinationCountry: destinationCountry.trim(),
          originCountry: originCountry.trim(),
          notes: notes.trim() ? [notes.trim()] : [],
          startISO: selectedSlot || undefined,
          additionalAttendees: extras.length ? extras : undefined,
        });
        successResult = result;
        toasts.success(result.hangoutLink ? 'Client created and call booked!' : 'Client created!');
        onSuccess(result);
      }
    } catch (err: any) {
      toasts.error(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      submitting = false;
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('scm-overlay')) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  onMount(() => {
    // Seed the picker's selection with the existing slot so the operator can
    // add an attendee (or just re-confirm) WITHOUT being forced to re-pick a
    // time. `slotChanged` stays false until they choose a genuinely new slot.
    if (mode === 'reschedule' && currentSlot) selectedSlot = currentSlot;
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="scm-overlay" on:click={handleOverlayClick} role="presentation">
  <div class="scm" role="dialog" aria-modal="true" aria-label={mode === 'reschedule' ? 'ReBook a consultation call' : 'Create new client'}>
    <!-- Header -->
    <div class="scm__header">
      <div class="scm__header-icon">{mode === 'reschedule' ? '📅' : '➕'}</div>
      <div class="scm__header-text">
        <h2 class="scm__title">
          {mode === 'reschedule' ? 'ReBook a consultation' : 'Create New Client'}
        </h2>
        <p class="scm__subtitle">
          {#if mode === 'reschedule'}
            {client?.displayName || client?.email || 'Client'} · change the time or add attendees
          {:else}
            Add a client manually from the CRM
          {/if}
        </p>
      </div>
      <button class="scm__close" type="button" on:click={onClose} aria-label="Close">✕</button>
    </div>

    {#if successResult}
      <!-- ── Success state ── -->
      <div class="scm__success">
        <div class="scm__success-icon">✅</div>
        <h3 class="scm__success-title">
          {#if attendeeOnly}
            {successResult.alreadyPresent ? 'Already Invited' : 'Invite Sent!'}
          {:else if mode === 'reschedule'}
            Call Rescheduled!
          {:else}
            {successResult.hangoutLink ? 'Client Created + Call Booked!' : 'Client Created!'}
          {/if}
        </h3>
        {#if successResult.hangoutLink}
          <a class="scm__meet-link" href={successResult.hangoutLink} target="_blank" rel="noopener noreferrer">
            🎥 Open Google Meet
          </a>
          {#if successResult.htmlLink}
            <a class="scm__cal-link" href={successResult.htmlLink} target="_blank" rel="noopener noreferrer">
              📅 View Calendar Event
            </a>
          {/if}
        {/if}
        <button class="scm__done-btn" type="button" on:click={onClose}>Done</button>
      </div>
    {:else}
      <div class="scm__body">
        <!-- ── Reschedule mode: current slot banner ── -->
        {#if mode === 'reschedule' && currentSlot}
          <div class="scm__current-slot">
            <span class="scm__current-slot-label">Current call</span>
            <span class="scm__current-slot-time">{currentSlotLabel}</span>
          </div>
        {/if}

        <!-- ── Create mode: mini-form ── -->
        {#if mode === 'create'}
          <div class="scm__form">
            <div class="scm__field scm__field--required">
              <label class="scm__label" for="scm-email">Email <span class="scm__req">*</span></label>
              <input
                id="scm-email"
                type="email"
                class="scm__input"
                class:scm__input--error={email && !emailValid}
                bind:value={email}
                placeholder="client@example.com"
                disabled={submitting}
              />
            </div>
            <div class="scm__row">
              <div class="scm__field">
                <label class="scm__label" for="scm-first">First Name</label>
                <input id="scm-first" type="text" class="scm__input" bind:value={firstName} placeholder="Jane" disabled={submitting} />
              </div>
              <div class="scm__field">
                <label class="scm__label" for="scm-last">Last Name</label>
                <input id="scm-last" type="text" class="scm__input" bind:value={lastName} placeholder="Smith" disabled={submitting} />
              </div>
            </div>
            <div class="scm__row">
              <div class="scm__field">
                <label class="scm__label" for="scm-phone">Phone</label>
                <input id="scm-phone" type="tel" class="scm__input" bind:value={phone} placeholder="+1 555 000 0000" disabled={submitting} />
              </div>
              <div class="scm__field">
                <label class="scm__label" for="scm-origin">From Country</label>
                <input id="scm-origin" type="text" class="scm__input" bind:value={originCountry} placeholder="USA" disabled={submitting} />
              </div>
            </div>
            <div class="scm__field">
              <label class="scm__label" for="scm-dest">Destination Country</label>
              <input id="scm-dest" type="text" class="scm__input" bind:value={destinationCountry} placeholder="Costa Rica" disabled={submitting} />
            </div>
            <div class="scm__field">
              <label class="scm__label" for="scm-notes">Notes</label>
              <textarea id="scm-notes" class="scm__input scm__input--textarea" bind:value={notes} placeholder="Any context about how they came in…" rows="2" disabled={submitting}></textarea>
            </div>
            <p class="scm__form-hint">
              {#if mode === 'create'}
                A consultation call is optional — you can create the client now and schedule later.
              {/if}
            </p>
          </div>
        {/if}

        <!-- ── Attendees ── -->
        <div class="scm__attendees">
          <p class="scm__attendees-label">
            Attendees
            {#if mode === 'create'}
              <span class="scm__attendees-sub">— first is primary client lead</span>
            {:else}
              <span class="scm__attendees-optional">— add someone to this call</span>
            {/if}
          </p>
          <!-- Read-only chips: people already on the invite (reschedule mode) -->
          {#if mode === 'reschedule' && alreadyInvited.length}
            <div class="scm__invited">
              {#each alreadyInvited as inv}
                <span class="scm__invited-chip" title={inv}>✓ {inv}</span>
              {/each}
            </div>
          {/if}
          {#if mode === 'create'}
            <div class="scm__attendee-row scm__attendee-row--primary">
              <span class="scm__attendee-star scm__attendee-star--fixed" title="Primary client lead">★</span>
              <span class="scm__attendee-primary-email">{email.trim() || '(enter email above)'}</span>
            </div>
          {/if}
          {#each extraAttendees as _att, i}
            <div class="scm__attendee-row">
              {#if mode === 'create'}
                <button class="scm__attendee-star scm__attendee-star--btn" type="button"
                  title="Set as primary client lead" on:click={() => promoteAttendee(i)}
                  disabled={submitting} aria-label="Set as primary">★</button>
              {:else}
                <span class="scm__attendee-dot">•</span>
              {/if}
              <input type="email" class="scm__input scm__attendee-input"
                bind:value={extraAttendees[i]}
                placeholder="attendee@example.com"
                disabled={submitting} />
              <button class="scm__attendee-del" type="button"
                on:click={() => removeAttendee(i)} disabled={submitting} aria-label="Remove">×</button>
            </div>
          {/each}
          <button class="scm__add-attendee" type="button" on:click={addAttendee} disabled={submitting}>
            + Add attendee
          </button>
        </div>

        <!-- ── Availability picker ── -->
        <div class="scm__picker-wrap">
          <p class="scm__picker-label">
            {mode === 'reschedule' ? 'Change time slot (optional)' : 'Schedule a call (optional)'}
          </p>
          <AvailabilityPicker
            theme="light"
            slotTheme="light"
            staffMode={true}
            preselected={mode === 'reschedule' ? (currentSlot ?? '') : ''}
            disabled={submitting}
            onSelect={(iso) => { selectedSlot = iso; }}
          />
        </div>

        <!-- Confirm button -->
        <div class="scm__actions">
          <button class="scm__cancel-btn" type="button" on:click={onClose} disabled={submitting}>Cancel</button>
          <button
            class="scm__confirm-btn"
            type="button"
            disabled={!canSubmit}
            on:click={handleSubmit}
          >
            {#if submitting}
              <span class="scm__spinner"></span>
              {mode === 'reschedule' ? (slotChanged ? 'Rescheduling…' : 'Sending invite…') : 'Creating…'}
            {:else if mode === 'reschedule'}
              {#if slotChanged}📅 Confirm Reschedule{:else}👥 Add Attendee & Send Invite{/if}
            {:else if selectedSlot}
              ➕ Create Client + Book Call
            {:else}
              ➕ Create Client
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .scm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .scm {
    background: var(--irp-surface);
    border-radius: var(--irp-r-xl);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .scm__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid var(--irp-slate-100);
    position: sticky;
    top: 0;
    background: var(--irp-surface);
    z-index: 1;
  }

  .scm__header-icon { font-size: 1.6rem; flex-shrink: 0; margin-top: 1px; }

  .scm__header-text { flex: 1; min-width: 0; }

  .scm__title {
    font-size: var(--irp-fs-lg);
    font-weight: 700;
    color: var(--irp-text);
    margin: 0 0 2px;
  }

  .scm__subtitle {
    font-size: var(--irp-fs-sm);
    color: var(--irp-text-dim);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scm__close {
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
  .scm__body { padding: 1rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

  /* Current slot banner (reschedule mode) */
  .scm__current-slot {
    background: var(--irp-surface-2);
    border: 1px solid rgba(2, 181, 187, 0.25);
    border-radius: var(--irp-r-md);
    padding: 0.65rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .scm__current-slot-label {
    font-size: var(--irp-fs-2xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--irp-accent-ink);
  }

  .scm__current-slot-time {
    font-size: var(--irp-fs-md);
    color: var(--irp-text);
    font-weight: 600;
  }

  /* Create-mode form */
  .scm__form {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .scm__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  .scm__field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .scm__label {
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--irp-text-muted);
  }

  .scm__req { color: var(--irp-red-600); }

  .scm__input {
    border: 1.5px solid var(--irp-line);
    border-radius: var(--irp-r-sm);
    padding: 0.45rem 0.65rem;
    font-size: var(--irp-fs-md);
    font-family: inherit;
    color: var(--irp-text);
    transition: border-color 0.15s;
    outline: none;
    background: var(--irp-surface);
    &:focus { border-color: var(--irp-accent); }
    &--error { border-color: var(--irp-red-500); }
    &--textarea { resize: none; }
    &:disabled { opacity: 0.6; }
  }

  .scm__form-hint {
    font-size: var(--irp-fs-xs);
    color: var(--irp-text-dim);
    margin: 0;
    font-style: italic;
  }

  /* Picker wrapper */
  .scm__picker-wrap { display: flex; flex-direction: column; gap: 0.4rem; }

  .scm__picker-label {
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--irp-text-muted);
    margin: 0;
  }

  /* Actions */
  .scm__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 0.25rem;
  }

  .scm__cancel-btn {
    padding: 0.55rem 1.1rem;
    border: 1.5px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    background: transparent;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-md);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: var(--irp-surface-2); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .scm__confirm-btn {
    padding: 0.55rem 1.4rem;
    border: none;
    border-radius: var(--irp-r-md);
    background: var(--irp-accent);
    color: var(--irp-text-inverse);
    font-size: var(--irp-fs-md);
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: background 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { background: var(--irp-accent-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  /* Success state */
  .scm__success {
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .scm__success-icon { font-size: 2.5rem; }

  .scm__success-title {
    font-size: var(--irp-fs-xl);
    font-weight: 700;
    color: var(--irp-text);
    margin: 0;
  }

  .scm__meet-link, .scm__cal-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.2rem;
    border-radius: var(--irp-r-md);
    font-size: var(--irp-fs-md);
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s;
  }

  .scm__meet-link {
    background: var(--irp-accent);
    color: var(--irp-text-inverse);
    &:hover { background: var(--irp-accent-hover); }
  }

  .scm__cal-link {
    background: var(--irp-surface-3);
    color: var(--irp-text-2);
    &:hover { background: var(--irp-surface-4); }
  }

  .scm__done-btn {
    margin-top: 0.25rem;
    padding: 0.5rem 1.5rem;
    border: 1.5px solid var(--irp-line);
    border-radius: var(--irp-r-md);
    background: transparent;
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-md);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    &:hover { background: var(--irp-surface-2); }
  }

  /* ── Attendees ── */
  .scm__attendees {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .scm__attendees-label {
    font-size: var(--irp-fs-xs);
    font-weight: 700;
    color: var(--irp-text-muted);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .scm__attendees-sub { font-weight: 400; color: var(--irp-text-dim); }
  .scm__attendees-optional { font-weight: 400; color: var(--irp-text-dim); font-style: italic; }
  /* Read-only "already invited" chips */
  .scm__invited { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 2px; }
  .scm__invited-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    background: var(--irp-surface-2);
    border: 1px solid rgba(2, 181, 187, 0.28);
    border-radius: var(--irp-r-full);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    color: var(--irp-accent-ink);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scm__attendee-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    &--primary { padding: 0.3rem 0; }
  }
  .scm__attendee-star {
    font-size: var(--irp-fs-md);
    flex-shrink: 0;
    width: 24px;
    text-align: center;
    &--fixed { color: var(--irp-accent-ink); }
    &--btn {
      background: none;
      border: none;
      color: var(--irp-text-dim);
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      transition: color 0.15s;
      &:hover:not(:disabled) { color: var(--irp-accent-ink); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }
  .scm__attendee-dot { color: var(--irp-text-dim); flex-shrink: 0; width: 24px; text-align: center; }
  .scm__attendee-primary-email {
    font-size: var(--irp-fs-sm);
    color: var(--irp-text);
    font-weight: 500;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .scm__attendee-input {
    flex: 1;
    min-width: 0;
  }
  .scm__attendee-del {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    background: var(--irp-surface-2);
    border: 1px solid var(--irp-red-200);
    border-radius: var(--irp-r-xs);
    color: var(--irp-red-600);
    font-size: var(--irp-fs-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: var(--irp-red-100); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
  .scm__add-attendee {
    align-self: flex-start;
    background: none;
    border: 1px dashed var(--irp-line);
    border-radius: var(--irp-r-sm);
    color: var(--irp-text-dim);
    font-size: var(--irp-fs-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0.22rem 0.7rem;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
    &:hover:not(:disabled) { border-color: var(--irp-accent); color: var(--irp-accent-ink); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  .scm__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: var(--irp-slate-0);
    border-radius: 50%;
    animation: scm-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes scm-spin { to { transform: rotate(360deg); } }
</style>
