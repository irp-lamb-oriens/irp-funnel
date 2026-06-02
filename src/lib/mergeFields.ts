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
 * Flatten a client/project object (from the `$project` store on the status page)
 * into a single-level context object keyed by the `path` values above.
 */
export function buildMergeContext(project: Record<string, any> | null | undefined): Record<string, string> {
  if (!project) return {};
  const latest = (Array.isArray(project.consultations) ? project.consultations[0] : null) ?? {};
  return {
    fullName: [project.name, project.surname].filter(Boolean).join(' '),
    name:               project.name             ?? '',
    surname:            project.surname          ?? '',
    email:              project.email            ?? '',
    originCity:         latest.originCity        ?? '',
    originCountry:      latest.originCountry     ?? '',
    destinationCity:    latest.destinationCity   ?? '',
    destinationCountry: latest.destinationCountry ?? '',
    size:               latest.size              ?? '',
    vehicles:           latest.vehicles          ?? '',
    budget:             latest.budget            ?? '',
    scheduling:         latest.scheduling        ?? '',
    immigrationStatus:  latest.immigrationStatus ?? '',
  };
}

// ─── Substitution engine ─────────────────────────────────────────────────────

/**
 * Replace all {{token}} placeholders in an HTML string with real values.
 * - Unknown tokens are left as-is (non-destructive).
 * - Empty values leave the token in place so broken substitutions are visible.
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
