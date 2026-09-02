/**
 * Client-side timezone helpers for the consultation scheduler.
 *
 * Business rule: consultation slots are generated in the organization's
 * timezone (America/Costa_Rica). The slot VALUES (ISO strings) are absolute
 * instants in time and never change. Only the DISPLAYED time label is
 * transformed, so a client in, say, Pacific time sees the slot rendered in
 * their own timezone instead of reading "2:00 PM" and assuming it is their
 * local 2 PM.
 *
 * This is a pure UI/UX transformation. No business logic depends on these
 * helpers.
 */

/** The organization's canonical timezone. All slots are generated in this zone. */
export const ORG_TIMEZONE = "America/Costa_Rica";

/** The client's timezone as detected by the browser. */
export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ORG_TIMEZONE;
  } catch {
    return ORG_TIMEZONE;
  }
}

/** True when the client's timezone is the same as the org's. */
export function isClientInOrgTimezone(
  clientTz: string = getClientTimezone(),
): boolean {
  return clientTz === ORG_TIMEZONE;
}

/** Format a Date in the given timezone as a short time label (e.g. "2:00 PM"). */
export function formatTimeInZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** Format a Date in the given timezone as a full label (e.g. "Mon, Sep 1, 2:00 PM"). */
export function formatDateTimeInZone(date: Date, timeZone: string): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

/** Get the UTC offset in minutes for a given timezone at a given instant. */
function getOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const asUTC = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
    return (asUTC - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

/**
 * Human-readable timezone difference between the client and the org.
 * Returns null when the client is in the org timezone (no notice needed).
 *
 * Example: "2 hours ahead of Costa Rica" or "1 hour 30 minutes behind Costa Rica".
 */
export function getTimezoneNotice(
  clientTz: string = getClientTimezone(),
): string | null {
  if (clientTz === ORG_TIMEZONE) return null;

  const now = new Date();
  const orgOffset = getOffsetMinutes(now, ORG_TIMEZONE);
  const clientOffset = getOffsetMinutes(now, clientTz);
  const diffMinutes = clientOffset - orgOffset;

  if (diffMinutes === 0) return null;

  const abs = Math.abs(diffMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  const amount = parts.join(" and ") || "0 minutes";

  return diffMinutes > 0
    ? `${amount} ahead of Costa Rica`
    : `${amount} behind Costa Rica`;
}

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Los_Angeles": "Pacific Time",
  "America/Vancouver": "Pacific Time",
  "America/Tijuana": "Pacific Time",
  "America/Denver": "Mountain Time",
  "America/Edmonton": "Mountain Time",
  "America/Phoenix": "Arizona Time",
  "America/Chicago": "Central Time",
  "America/Mexico_City": "Central Time",
  "America/Winnipeg": "Central Time",
  "America/New_York": "Eastern Time",
  "America/Toronto": "Eastern Time",
  "America/Bogota": "Colombia Time",
  "America/Lima": "Peru Time",
  "America/Santiago": "Chile Time",
  "America/Buenos_Aires": "Argentina Time",
  "America/Sao_Paulo": "Brasilia Time",
  "Europe/London": "UK Time",
  "Europe/Lisbon": "Western European Time",
  "Europe/Madrid": "Central European Time",
  "Europe/Paris": "Central European Time",
  "Europe/Berlin": "Central European Time",
  "Europe/Rome": "Central European Time",
  "Europe/Amsterdam": "Central European Time",
  "Europe/Brussels": "Central European Time",
  "Europe/Zurich": "Central European Time",
  "Europe/Stockholm": "Central European Time",
  "Europe/Oslo": "Central European Time",
  "Europe/Copenhagen": "Central European Time",
  "Europe/Warsaw": "Central European Time",
  "Europe/Athens": "Eastern European Time",
  "Europe/Helsinki": "Eastern European Time",
  "Europe/Bucharest": "Eastern European Time",
  "Asia/Dubai": "Gulf Time",
  "Asia/Karachi": "Pakistan Time",
  "Asia/Kolkata": "India Time",
  "Asia/Dhaka": "Bangladesh Time",
  "Asia/Bangkok": "Indochina Time",
  "Asia/Singapore": "Singapore Time",
  "Asia/Hong_Kong": "Hong Kong Time",
  "Asia/Shanghai": "China Time",
  "Asia/Tokyo": "Japan Time",
  "Asia/Seoul": "Korea Time",
  "Australia/Perth": "Australian Western Time",
  "Australia/Adelaide": "Australian Central Time",
  "Australia/Sydney": "Australian Eastern Time",
  "Australia/Brisbane": "Australian Eastern Time",
  "Pacific/Auckland": "New Zealand Time",
};

/** Friendly display label for a timezone (e.g. "Pacific Time"). Falls back to the IANA name. */
export function getTimezoneLabel(timeZone: string): string {
  return TIMEZONE_LABELS[timeZone] || timeZone.replace(/_/g, " ");
}