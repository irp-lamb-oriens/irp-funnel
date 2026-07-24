/**
 * Client-side mirror of the server scheduling rule in
 * `irp-funnel-server/API/chatbot/agents/scheduling-policy.ts`
 * (`interCallBufferMinutes` + `conflictsWithBusy`).
 *
 * The browser can't import the Deno server module, so this small helper keeps
 * the calendar pickers (Calendar.svelte, AvailabilityPicker.svelte) in lockstep
 * with the backend: a slot is unavailable when it overlaps a busy event OR sits
 * within the 30-min inter-call buffer of one. Consultation calls are never
 * booked back-to-back — the team needs that gap to enter details before quoting.
 *
 * ⚠️ Keep the two constants below in sync with SCHEDULING_POLICY on the server.
 */

export const SLOT_DURATION_MS = 30 * 60 * 1000;
export const INTER_CALL_BUFFER_MS = 30 * 60 * 1000;

export interface BusyEvent {
  start: number; // epoch ms
  end: number; // epoch ms
}

/**
 * Parse the raw Google Calendar events returned by `/api/events` into busy
 * intervals. Timed events use `start/end.dateTime`; anything without a parseable
 * timed start is skipped (all-day events don't map onto a 30-min slot grid).
 * Missing/invalid ends fall back to a 30-min block so a lone start still blocks.
 */
export function parseBusyEvents(events: any[]): BusyEvent[] {
  const busy: BusyEvent[] = [];
  for (const e of events ?? []) {
    const startMs = new Date(e?.start?.dateTime ?? "").getTime();
    if (isNaN(startMs)) continue;
    const endRaw = new Date(e?.end?.dateTime ?? "").getTime();
    const endMs = isNaN(endRaw) ? startMs + SLOT_DURATION_MS : endRaw;
    busy.push({ start: startMs, end: endMs });
  }
  return busy;
}

/**
 * True when a 30-min slot starting at `slotStartMs` collides with any busy
 * interval once expanded by the inter-call buffer on both sides. Identical rule
 * to the server's `conflictsWithBusy`, so the UI never offers a slot the API
 * would reject (and never books two calls back-to-back).
 */
export function slotConflictsWithBusy(
  slotStartMs: number,
  busy: BusyEvent[],
  bufferMs: number = INTER_CALL_BUFFER_MS,
): boolean {
  const slotEndMs = slotStartMs + SLOT_DURATION_MS;
  return busy.some(
    (b) => slotStartMs < b.end + bufferMs && slotEndMs > b.start - bufferMs,
  );
}
