/**
 * mergeFields.ts — Merge-field registry and render-time substitution.
 *
 * Template authors can insert tokens like {{client.fullName}} into HTML blocks.
 * At render-time (BlockRenderer on the status page), the tokens are replaced
 * with the actual consultation values — non-destructively (unknown tokens
 * are left as-is so nothing breaks).
 *
 * Used by: BlockRenderer (render-time), TemplatesView (field picker UI).
 * The seed script uses IRP_STANDARD_TEMPLATE (exported below).
 */

// ─── Registry ────────────────────────────────────────────────────────────────

export interface MergeField {
  /** Full `{{token}}` string injected into template HTML */
  token: string;
  /** Human-readable label shown in the Insert-field picker */
  label: string;
  /** Grouping for the picker UI: Client | Route | Move */
  group: 'Client' | 'Route' | 'Move';
  /** Dotted path into the flat merge context produced by buildMergeContext() */
  path: string;
  /** Example value shown next to each field in the picker */
  example: string;
}

export const MERGE_FIELDS: MergeField[] = [
  // ─── Client ──────────────────────────────────────────────────────────────
  { token: '{{client.fullName}}',           label: 'Full Name',              group: 'Client', path: 'fullName',           example: 'Jessica Cooper' },
  { token: '{{client.name}}',               label: 'First Name',             group: 'Client', path: 'name',               example: 'Jessica' },
  { token: '{{client.surname}}',            label: 'Last Name',              group: 'Client', path: 'surname',            example: 'Cooper' },
  { token: '{{client.email}}',              label: 'Email',                  group: 'Client', path: 'email',              example: 'jessica@email.com' },
  // ─── Route ────────────────────────────────────────────────────────────────
  { token: '{{route.originCity}}',          label: 'Origin City',            group: 'Route',  path: 'originCity',         example: 'Myrtle Beach, SC' },
  { token: '{{route.originCountry}}',       label: 'Origin Country',         group: 'Route',  path: 'originCountry',      example: 'United States' },
  { token: '{{route.destinationCity}}',     label: 'Destination City',       group: 'Route',  path: 'destinationCity',    example: 'Grecia, Alajuela' },
  { token: '{{route.destinationCountry}}',  label: 'Destination Country',    group: 'Route',  path: 'destinationCountry', example: 'Costa Rica' },
  // ─── Move ─────────────────────────────────────────────────────────────────
  { token: '{{move.size}}',                 label: 'Move Size',              group: 'Move',   path: 'size',               example: '1x40ft container' },
  { token: '{{move.vehicles}}',             label: 'Vehicles',               group: 'Move',   path: 'vehicles',           example: '1 vehicle' },
  { token: '{{move.budget}}',               label: 'Budget',                 group: 'Move',   path: 'budget',             example: '$20,000–$25,000' },
  { token: '{{move.scheduling}}',           label: 'Move Date / Scheduling', group: 'Move',   path: 'scheduling',         example: 'Q1 2025' },
  { token: '{{move.immigrationStatus}}',    label: 'Immigration Status',     group: 'Move',   path: 'immigrationStatus',  example: 'Pensionado' },
];

// ─── Context builder ─────────────────────────────────────────────────────────

/**
 * Flatten a client/project object into a single-level context object keyed by
 * the `path` values above.
 *
 * IMPORTANT: The client-status endpoint (`/api/client-status/project/:id`)
 * returns a FLAT `safeSummary` — all Route/Move fields are at the TOP LEVEL
 * (e.g. `project.originCountry`, `project.size`) with NO `consultations` array.
 * We therefore read top-level fields first and fall back to `consultations[0]`
 * for contexts where the full nested Firestore document is passed (e.g. the
 * dashboard / AI pipeline).
 *
 * Also handles array-shaped fields that arrive on the client-status endpoint:
 *   • `vehicles`   — array of {year,make,model} objects or plain strings
 *   • `scheduling` — array of ISO-8601 date strings
 */
export function buildMergeContext(project: Record<string, any> | null | undefined): Record<string, string> {
  if (!project) return {};

  // Nested-doc fallback (e.g. dashboard or AI pipeline passes full Firestore doc)
  const latest = (Array.isArray(project.consultations) ? project.consultations[0] : null) ?? {};

  // ── vehicles → human-readable string ──────────────────────────────────────
  const rawVehicles = project.vehicles ?? latest.vehicles;
  let vehiclesStr = '';
  if (Array.isArray(rawVehicles) && rawVehicles.length > 0) {
    vehiclesStr = rawVehicles
      .map((v: any) =>
        typeof v === 'object' && v !== null
          ? [v.year, v.make, v.model].filter(Boolean).join(' ')
          : String(v),
      )
      .join(', ');
  } else if (typeof rawVehicles === 'string' && rawVehicles) {
    vehiclesStr = rawVehicles;
  }

  // ── scheduling → first date, human-readable ───────────────────────────────
  const rawScheduling = project.scheduling ?? latest.scheduling;
  let schedulingStr = '';
  if (Array.isArray(rawScheduling) && rawScheduling.length > 0) {
    const d = new Date(rawScheduling[0]);
    schedulingStr = isNaN(d.getTime())
      ? String(rawScheduling[0])
      : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else if (typeof rawScheduling === 'string' && rawScheduling) {
    schedulingStr = rawScheduling;
  }

  return {
    // Client — top-level on both flat and nested shapes
    fullName: [project.name ?? latest.name, project.surname ?? latest.surname].filter(Boolean).join(' '),
    name:               project.name              ?? latest.name              ?? '',
    surname:            project.surname           ?? latest.surname           ?? '',
    email:              project.email             ?? latest.email             ?? '',
    // Route — top-level on flat safeSummary; fallback to consultations[0]
    originCity:         project.originCity        ?? latest.originCity        ?? '',
    originCountry:      project.originCountry     ?? latest.originCountry     ?? '',
    destinationCity:    project.destinationCity   ?? latest.destinationCity   ?? '',
    destinationCountry: project.destinationCountry ?? latest.destinationCountry ?? '',
    // Move — same flat vs nested dual-read
    size:               project.size              ?? latest.size              ?? '',
    vehicles:           vehiclesStr,
    budget:             project.budget            ?? latest.budget            ?? '',
    scheduling:         schedulingStr,
    immigrationStatus:  project.immigrationStatus ?? latest.immigrationStatus ?? '',
  };
}

// ─── Substitution engine ─────────────────────────────────────────────────────

/**
 * Replace all {{token}} placeholders in an HTML string with real values.
 * - Unknown tokens are left as-is during the substitution loop.
 * - A final safety-net pass strips any remaining {{…}} so raw literals
 *   never leak through to the client UI — even for empty/missing fields.
 */
export function renderMergeFields(
  html: string,
  ctx: Record<string, string>,
): string {
  if (!html) return html;
  let result = html;
  for (const field of MERGE_FIELDS) {
    const val = ctx[field.path];
    if (val) {
      // Escape braces for use in RegExp
      const escaped = field.token.replace(/[{}]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), val);
    }
  }
  // Safety net: remove any {{...}} tokens that were not substituted
  // (unknown tokens or genuinely empty fields) so they never render
  // as visible literal text in the proposal.
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

// ─── Picker helper ───────────────────────────────────────────────────────────

/** Group MERGE_FIELDS by their group for the Insert-field picker UI. */
export function mergeFieldsByGroup(): Record<string, MergeField[]> {
  const out: Record<string, MergeField[]> = {};
  for (const f of MERGE_FIELDS) {
    (out[f.group] ??= []).push(f);
  }
  return out;
}
