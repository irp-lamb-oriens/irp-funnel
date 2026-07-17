/**
 * formatActivity.ts
 *
 * Pure function that turns one `activityLog[]` row into a structured
 * presentation payload: WHO did WHAT to WHICH field, WHEN (both relative
 * and exact), with an icon hint and an "undoable" flag.
 *
 * Used by `<CardHistory>` (inline on the card) and the Activity tab in
 * the detail panel — same data, two surfaces.
 */

import {
  STAGE_LABELS,
  humanizeFieldLabel,
  type ActivityEntry,
} from '../store.ts';
import { exactTime, relativeTime } from './relativeTime.ts';

export interface FormattedActivity {
  /** Short blame label, e.g. "Luis", "system", "AI". */
  who: string;
  /** Human-readable summary: "edited Origin City". */
  what: string;
  /** Optional diff detail: '"Miami" → "Orlando"'. May be empty. */
  detail: string;
  /** Friendly "3 min ago" / "yesterday at 14:22". */
  whenRelative: string;
  /** Exact timestamp suitable for a tooltip. */
  whenExact: string;
  /** Single-emoji icon to lead the row. */
  icon: string;
  /** True if the dashboard's Undo button can revert this entry. */
  undoable: boolean;
  /** Original activity entry — handy for click-throughs. */
  raw: ActivityEntry;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'string') return v.length > 60 ? `"${v.slice(0, 60)}…"` : `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  }
  if (typeof v === 'object') return '{…}';
  return String(v);
}

function blameOf(entry: any): string {
  const actor = entry?.actor ?? '';
  if (!actor) return 'someone';
  if (actor === 'system' || actor.startsWith('system:')) {
    if (actor.includes('extractor')) return 'AI';
    if (actor.includes('drip')) return 'drip';
    if (actor.includes('scheduler')) return 'scheduler';
    return 'system';
  }
  // Take the email's local-part: "luisarmando@..." → "luisarmando"
  const localPart = actor.split('@')[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

export function formatActivity(entry: ActivityEntry): FormattedActivity {
  const e: any = entry;
  const who = blameOf(entry);
  const whenRelative = relativeTime(entry.timestamp);
  const whenExact = exactTime(entry.timestamp);

  switch (e.type) {
    case 'field_edit': {
      const label = humanizeFieldLabel(e.fieldPath || '');
      return {
        who,
        what: `edited ${label}`,
        detail: `${formatValue(e.oldValue)} → ${formatValue(e.newValue)}`,
        whenRelative,
        whenExact,
        icon: '✏️',
        undoable: true,
        raw: entry,
      };
    }
    case 'field_revert': {
      const label = humanizeFieldLabel(e.fieldPath || '');
      return {
        who,
        what: `reverted ${label}`,
        detail: `${formatValue(e.oldValue)} → ${formatValue(e.newValue)}`,
        whenRelative,
        whenExact,
        icon: '↩',
        undoable: true,
        raw: entry,
      };
    }
    case 'stage_change': {
      const from = STAGE_LABELS[e.from] || e.from || '?';
      const to = STAGE_LABELS[e.to] || e.to || '?';
      return {
        who,
        what: 'moved pipeline stage',
        detail: `${from} → ${to}`,
        whenRelative,
        whenExact,
        icon: '🔀',
        undoable: true,
        raw: entry,
      };
    }
    case 'note_added':
      return {
        who,
        what: 'added a note',
        detail: '',
        whenRelative,
        whenExact,
        icon: '📝',
        undoable: false,
        raw: entry,
      };
    case 'email_triggered':
    case 'email_sent': {
      // Friendly labels for emails sent outside the client-drip registry
      // (to providers, or to the team via the quote system). Unknown types fall
      // back to the raw key so nothing is ever hidden from the audit feed.
      const EMAIL_TYPE_LABELS: Record<string, string> = {
        provider_rfq: 'provider RFQ',
        provider_selected: 'provider selection',
        provider_rating_request: 'provider rating request',
        quote_approval_request: 'quote approval request',
        quote_to_client: 'quote to client',
        pricing_request: 'pricing-desk request',
      };
      const label = EMAIL_TYPE_LABELS[e.emailType] ?? e.emailType ?? 'custom';
      const firstRecipient =
        typeof e.recipientEmail === 'string' && e.recipientEmail
          ? e.recipientEmail.split(',')[0].trim()
          : '';
      return {
        who,
        what: `sent a "${label}" email`,
        detail: firstRecipient ? `→ ${firstRecipient}` : '',
        whenRelative,
        whenExact,
        icon: '📧',
        undoable: false,
        raw: entry,
      };
    }

    case 'client_reply': {
      const msg = typeof e.message === 'string' ? e.message : '';
      const preview = msg.length > 80 ? `"${msg.slice(0, 80)}…"` : msg ? `"${msg}"` : '';
      return {
        who: 'client',
        what: 'replied via the answer page',
        detail: preview,
        whenRelative,
        whenExact,
        icon: '💬',
        undoable: false,
        raw: entry,
      };
    }
    case 'gemini_notes_received':

      return {
        who,
        what: 'received meeting notes from Gemini',
        detail: e.docTitle ? `"${e.docTitle}"` : '',
        whenRelative,
        whenExact,
        icon: '🪄',
        undoable: false,
        raw: entry,
      };
    case 'insights_extracted': {
      const mode = e.shippingMode ?? '—';
      const tier = e.packingTier ?? '—';
      return {
        who,
        what: 'extracted AI insights from transcript',
        detail: `${mode} / ${tier}`,
        whenRelative,
        whenExact,
        icon: '🤖',
        undoable: false,
        raw: entry,
      };
    }
    case 'action_executed':
      return {
        who,
        what: `executed action ${e.actionKey ?? ''}`,
        detail: e.success === false ? '(failed)' : '',
        whenRelative,
        whenExact,
        icon: '⚡',
        undoable: false,
        raw: entry,
      };
    case 'field_update':
      return {
        who,
        what: `updated ${(e.fields || []).join(', ') || 'fields'}`,
        detail: '',
        whenRelative,
        whenExact,
        icon: '✏️',
        undoable: false,
        raw: entry,
      };
    case 'attendees_added': {
      const list: string[] = Array.isArray(e.addedAttendees) ? e.addedAttendees : [];
      const detail = list.length
        ? (list.length <= 2 ? list.join(', ') : `${list.slice(0, 2).join(', ')} +${list.length - 2}`)
        : '';
      return {
        who,
        what: list.length === 1 ? 'added an attendee to the call' : 'added attendees to the call',
        detail,
        whenRelative,
        whenExact,
        icon: '👥',
        undoable: false,
        raw: entry,
      };
    }
    default:

      return {
        who,
        what: e.type ?? 'event',
        detail: '',
        whenRelative,
        whenExact,
        icon: '•',
        undoable: false,
        raw: entry,
      };
  }
}
