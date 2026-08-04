/**
 * Centralized WhatsApp link building.
 *
 * Two distinct destinations exist:
 *  - SUPPORT_WHATSAPP_PHONE: the public "chat with us" number shown in the funnel.
 *  - SALES_WHATSAPP_PHONE: Pablo, who receives the post-booking client handoff.
 */
import countries from "../components/systems/inputs/Country/countries.ts";
import type { FormState } from "../components/systems/inputs/Calendar/formStore.js";

export const SUPPORT_WHATSAPP_PHONE = "+15186227134";

/** Pablo Ernesto Arias Campos — receives booked-consultation handoffs. */
export const SALES_WHATSAPP_PHONE = "+50671086045";

const CONSULTATION_TIMEZONE = "America/Costa_Rica";

function countryName(code: string): string {
  return countries.find((c) => c.code === code)?.name || code || "";
}

/** Human-readable date/time in the consultation timezone. Returns "" when unparseable. */
export function formatConsultationDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: CONSULTATION_TIMEZONE,
  }).format(date);
}

function notesToText(notes: FormState["notes"]): string {
  if (Array.isArray(notes)) {
    return notes
      .map((n: any) => (typeof n === "string" ? n : n?.text ?? ""))
      .filter(Boolean)
      .join(" | ");
  }
  return typeof notes === "string" ? notes.trim() : "";
}

/**
 * Message Pablo receives when a client books a consultation, from either the
 * hero form or the Lily chat. Contains every field the client provided.
 */
export function buildBookedConsultationMessage(
  form: Partial<FormState>,
  opts: { source: "form" | "lily"; scheduledAt?: string } = { source: "form" }
): string {
  const fullName = [form.name, form.surname].filter(Boolean).join(" ").trim();
  const scheduledIso = opts.scheduledAt || form.scheduling?.[0] || "";
  const scheduled = scheduledIso ? formatConsultationDateTime(scheduledIso) : "";

  const lines: string[] = [];
  lines.push(
    `Hi Pablo, I'm a booked a consultation${
      opts.source === "lily" ? " through Lily" : " through the website form"
    }.`
  );
  if (fullName) lines.push(`*Client:* ${fullName}`);
  if (scheduled) lines.push(`*Call scheduled for:* ${scheduled}`);
  lines.push("");

  const push = (label: string, value?: string | null) => {
    if (value && String(value).trim()) lines.push(`*${label}:* ${String(value).trim()}`);
  };

  push("Email", form.email);
  push("Phone", form.phone);
  if (form.originCountry || form.originCity) {
    push(
      "Moving from",
      `${form.originCity ? form.originCity + ", " : ""}${countryName(form.originCountry || "")}${
        form.originZip ? " " + form.originZip : ""
      }`
    );
  }
  if (form.destinationCountry || form.destinationCity) {
    push(
      "Moving to",
      `${form.destinationCity ? form.destinationCity + ", " : ""}${countryName(
        form.destinationCountry || ""
      )}${form.destinationZip ? " " + form.destinationZip : ""}`
    );
  }
  push("Budget", form.budget);
  push("Move size", form.size);
  push("Moving out of", form.propertyTypeFrom);
  push("Moving into", form.propertyTypeTo);
  push("Immigration status", form.immigrationStatus);
  if (form.vehicles?.length) {
    push(
      "Vehicles",
      form.vehicles.map((v) => [v.year, v.make, v.model].filter(Boolean).join(" ")).join(" | ")
    );
  }
  push("Referred by", form.referredBy);
  push("YouTube video", form.youtubeVideo);
  push("Notes", notesToText(form.notes));

  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp in a new tab; falls back to same-tab navigation if blocked. */
export function openWhatsApp(phone: string, text: string): void {
  if (typeof window === "undefined") return;
  const url = buildWhatsAppUrl(phone, text);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
}
