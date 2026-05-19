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
  import { rescheduleCall, createClientFromCrm } from '../store.ts';
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

  // Create-mode form fields
  let email = '';
  let firstName = '';
  let lastName = '';
  let phone = '';
  let destinationCountry = '';
  let originCountry = '';
  let notes = '';

  // Validation
  $: emailValid = email.includes('@') && email.includes('.');
  $: canSubmit = !submitting && (
    mode === 'reschedule'
      ? !!selectedSlot
      : emailValid
  );

  // Current slot label for reschedule mode
  $: currentSlot = client?.scheduling?.[0] ?? client?.lastCalendarEvent?.startTime ?? '';
  $: currentSlotLabel = currentSlot
    ? new Date(currentSlot).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Costa_Rica',
      }) + ' (CR time)'
    : 'No call scheduled';

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return;
    submitting = true;
    try {
      if (mode === 'reschedule' && client) {
        const result = await rescheduleCall(client.id, selectedSlot);
        successResult = result;
        toasts.success('Call rescheduled! Google Meet link is ready.');
        onSuccess(result);
      } else {
        const result = await createClientFromCrm({
          email: email.trim(),
          name: firstName.trim(),
          surname: lastName.trim(),
          phone: phone.trim(),
          destinationCountry: destinationCountry.trim(),
          originCountry: originCountry.trim(),
          notes: notes.trim() ? [notes.trim()] : [],
          startISO: selectedSlot || undefined,
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
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="scm-overlay" on:click={handleOverlayClick} role="presentation">
  <div class="scm" role="dialog" aria-modal="true" aria-label={mode === 'reschedule' ? 'Reschedule consultation call' : 'Create new client'}>
    <!-- Header -->
    <div class="scm__header">
      <div class="scm__header-icon">{mode === 'reschedule' ? '📅' : '➕'}</div>
      <div class="scm__header-text">
        <h2 class="scm__title">
          {mode === 'reschedule' ? 'Reschedule Consultation' : 'Create New Client'}
        </h2>
        <p class="scm__subtitle">
          {#if mode === 'reschedule'}
            {client?.displayName || client?.email || 'Client'} · pick a new time slot
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
          {mode === 'reschedule' ? 'Call Rescheduled!' : successResult.hangoutLink ? 'Client Created + Call Booked!' : 'Client Created!'}
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

        <!-- ── Availability picker ── -->
        <div class="scm__picker-wrap">
          <p class="scm__picker-label">
            {mode === 'reschedule' ? 'New time slot' : 'Schedule a call (optional)'}
          </p>
          <AvailabilityPicker
            theme="light"
            slotTheme="light"
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
              {mode === 'reschedule' ? 'Rescheduling…' : 'Creating…'}
            {:else if mode === 'reschedule'}
              📅 Confirm Reschedule
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
    background: #fff;
    border-radius: 18px;
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
    border-bottom: 1px solid #f1f5f9;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 1;
  }

  .scm__header-icon { font-size: 1.6rem; flex-shrink: 0; margin-top: 1px; }

  .scm__header-text { flex: 1; min-width: 0; }

  .scm__title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 2px;
  }

  .scm__subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scm__close {
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
  .scm__body { padding: 1rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

  /* Current slot banner (reschedule mode) */
  .scm__current-slot {
    background: #f0fafa;
    border: 1px solid rgba(2, 181, 187, 0.25);
    border-radius: 10px;
    padding: 0.65rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .scm__current-slot-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #02b5bb;
  }

  .scm__current-slot-time {
    font-size: 0.88rem;
    color: #1e293b;
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
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }

  .scm__req { color: #ef4444; }

  .scm__input {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.45rem 0.65rem;
    font-size: 0.86rem;
    font-family: inherit;
    color: #1e293b;
    transition: border-color 0.15s;
    outline: none;
    background: #fff;
    &:focus { border-color: #02b5bb; }
    &--error { border-color: #ef4444; }
    &--textarea { resize: none; }
    &:disabled { opacity: 0.6; }
  }

  .scm__form-hint {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    font-style: italic;
  }

  /* Picker wrapper */
  .scm__picker-wrap { display: flex; flex-direction: column; gap: 0.4rem; }

  .scm__picker-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #475569;
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
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    background: transparent;
    color: #64748b;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: #f8fafc; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .scm__confirm-btn {
    padding: 0.55rem 1.4rem;
    border: none;
    border-radius: 10px;
    background: #02b5bb;
    color: #fff;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: background 0.15s, opacity 0.15s;
    &:hover:not(:disabled) { background: #019fa4; }
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
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }

  .scm__meet-link, .scm__cal-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.2rem;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s;
  }

  .scm__meet-link {
    background: #02b5bb;
    color: #fff;
    &:hover { background: #019fa4; }
  }

  .scm__cal-link {
    background: #f1f5f9;
    color: #334155;
    &:hover { background: #e2e8f0; }
  }

  .scm__done-btn {
    margin-top: 0.25rem;
    padding: 0.5rem 1.5rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    background: transparent;
    color: #64748b;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    &:hover { background: #f8fafc; }
  }

  .scm__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: scm-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes scm-spin { to { transform: rotate(360deg); } }
</style>
