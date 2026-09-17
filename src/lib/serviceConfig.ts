/**
 * lib/serviceConfig.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend mirror of the backend intake field config. Only types, a fetcher,
 * and the declarative condition evaluator live here — the field definitions
 * themselves come from the backend `/api/service-config` endpoint so the form
 * and the chatbot always share one source of truth.
 */

export type ServiceType = "relocation" | "relocation_tour" | "immigration";

export type ServiceFieldType =
  | "text"
  | "email"
  | "phone"
  | "country"
  | "options"
  | "people"
  | "notes"
  | "calendar"
  | "budget"
  | "move-size"
  | "immigration"
  | "property-from"
  | "property-to"
  | "vehicles";

export interface ServiceFieldOption {
  value: string;
  label: string;
}

export type FieldCondition =
  | { field: string; equals: unknown }
  | { field: string; oneOf: unknown[] };

export interface ServiceFieldDef {
  id: string;
  type: ServiceFieldType;
  label: string;
  placeholder?: string;
  options?: ServiceFieldOption[];
  required: boolean;
  perPerson?: boolean;
  fields?: ServiceFieldDef[];
  showWhen?: FieldCondition;
  chatbotQuestion: string;
  priority: number;
}

export interface ServiceConfig {
  type: ServiceType | "both" | "combined";
  label: string;
  fields: ServiceFieldDef[];
  chatbotFields: ServiceFieldDef[];
}

export function evaluateCondition(
  cond: FieldCondition | undefined,
  state: Record<string, any>,
): boolean {
  if (!cond) return true;
  const value = state[cond.field];
  if ("equals" in cond) return value === cond.equals;
  if ("oneOf" in cond) return (cond.oneOf as unknown[]).includes(value);
  return true;
}

/**
 * The three selectable services, in display order, for the service slide.
 * Selection is additive; "All of the above" is a master toggle rendered by the
 * slide, not a persisted value.
 */
export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "relocation", label: "International Shipping" },
  { value: "relocation_tour", label: "Relocation tours" },
  { value: "immigration", label: "Immigration consultancy" },
];

/** The full additive set, as one toggle. */
export const ALL_SERVICE_TYPES: readonly ServiceType[] = ["relocation", "relocation_tour", "immigration"];

/**
 * Normalize a raw service value from a URL param or legacy string into a
 * deduplicated list of atomic ServiceType codes. Handles comma/plus joins and
 * expands the legacy `both` alias to relocation + relocation_tour. Unknown
 * tokens are dropped, returning only known atomic codes.
 */
export function parseServiceTypes(raw: string): ServiceType[] {
  const atoms = raw
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((t) => (t === "both" ? ["relocation", "relocation_tour"] : [t]));
  const unique = Array.from(new Set(atoms));
  return unique.filter((t): t is ServiceType => ALL_SERVICE_TYPES.includes(t as ServiceType));
}

/**
 * Destination ISO-2 country codes that unlock the service-selection slide.
 * Destinations not listed here skip the slide and default to `relocation`
 * (International Shipping).
 */
export const SERVICE_SLIDE_GATE_COUNTRIES: readonly string[] = ["CR"];

/**
 * Derive the legacy `serviceCategory` string from a multi-select. Single
 * selection maps to its code; multiple selections map to a stable sorted,
 * comma-joined tag so existing string consumers keep working. Empty → "".
 */
export function deriveServiceCategory(types: ServiceType[]): string {
  const unique = Array.from(new Set(types)).filter(Boolean).sort();
  return unique.join(",");
}

/** Fetch one or more service configs from the backend, merged server-side. */
export async function fetchServiceConfig(
  apiBase: string,
  type: ServiceType | ServiceType[],
): Promise<ServiceConfig> {
  const value = Array.isArray(type) ? type.join(",") : type;
  const res = await fetch(`${apiBase}/api/service-config?type=${encodeURIComponent(value)}`);
  if (!res.ok) throw new Error("Unable to load the intake form.");
  const data = await res.json();
  return data.config as ServiceConfig;
}