/**
 * relativeTime.ts
 *
 * Friendly relative-time formatter for the audit log: "3 min ago",
 * "yesterday at 14:22", "May 4, 2026 13:51 (UTC-6)".
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 min ago" / "yesterday" / "May 2" / "May 2, 2025". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const now = Date.now();
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diff = now - ts;
  const future = diff < 0;
  const abs = Math.abs(diff);

  if (abs < 30 * SECOND) return 'just now';
  if (abs < MINUTE) {
    return future ? 'in a few seconds' : `${Math.floor(abs / SECOND)} sec ago`;
  }
  if (abs < HOUR) {
    const m = Math.floor(abs / MINUTE);
    return future ? `in ${m} min` : `${m} min ago`;
  }
  if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    return future ? `in ${h}h` : `${h}h ago`;
  }
  if (abs < 2 * DAY && !future) {
    const d = new Date(iso);
    return `yesterday at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (abs < 7 * DAY) {
    const d = Math.floor(abs / DAY);
    return future ? `in ${d}d` : `${d}d ago`;
  }
  // Older than a week — show the calendar date
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Exact human-readable timestamp: "May 4, 2026 · 13:51:02 (UTC-6:00)". */
export function exactTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  // Time-zone offset in ±HH:MM form
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const offAbs = Math.abs(offMin);
  const offH = Math.floor(offAbs / 60).toString().padStart(2, '0');
  const offM = (offAbs % 60).toString().padStart(2, '0');
  return `${date} · ${time} (UTC${sign}${offH}:${offM})`;
}
