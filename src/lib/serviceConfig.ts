/**
 * lib/serviceConfig.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend mirror of the backend intake field config. Only types, a fetcher,
 * and the declarative condition evaluator live here — the field definitions
 * themselves come from the backend `/api/service-config` endpoint so the form
 * and the chatbot always share one source of truth.
 */

export type ServiceType = "relocation" | "relocation_tour" | "both";

export type ServiceFieldType =
  | "text"
  | "email"
  | "phone"
  | "country"
  | "options"
  | "people"
  | "notes"
  | "calendar";

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
  type: ServiceType;
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

/** The three selectable services, in display order, for the service slide. */
export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "relocation", label: "Relocation consultancy" },
  { value: "relocation_tour", label: "Relocation tours" },
  { value: "both", label: "Both" },
];

/** Fetch one service config from the backend. */
export async function fetchServiceConfig(
  apiBase: string,
  type: ServiceType,
): Promise<ServiceConfig> {
  const res = await fetch(`${apiBase}/api/service-config?type=${type}`);
  if (!res.ok) throw new Error("Unable to load the intake form.");
  const data = await res.json();
  return data.config as ServiceConfig;
}