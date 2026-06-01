/**
 * access.ts — Centralized CRM section access control.
 *
 * This is the SINGLE SOURCE OF TRUTH for which emails can access which
 * dashboard views.  Admins (luisarmando, pablo) can also override this
 * live from the Admin panel — live overrides are persisted in Firestore
 * and fetched on login; they take precedence over this static map.
 *
 * To add or change access for a staff member:
 *   either edit this file and redeploy,
 *   or (preferred) use the Admin → Access Config tab in the dashboard.
 */

export type DashView = 'board' | 'list' | 'metrics' | 'evo' | 'providers' | 'posts' | 'admin';

export const ALL_VIEWS: DashView[] = ['board', 'list', 'metrics', 'evo', 'providers', 'posts', 'admin'];

/**
 * Static fallback access map.
 * Emails NOT listed here fall back to DEFAULT_ACCESS.
 */
export const STATIC_SECTION_ACCESS: Record<string, DashView[]> = {
  // ── Full access + admin panel ────────────────────────────────────────────
  'luisarmando@internationalrelocationpartner.com': ALL_VIEWS,
  'pablo@internationalrelocationpartner.com':       ALL_VIEWS,

  // ── Pricing team: board + list + providers ───────────────────────────────
  'pricing@internationalrelocationpartner.com': ['board', 'list', 'providers'],

  // ── Operations / pricing team members ────────────────────────────────────
  'mariancanales@internationalrelocationpartner.com': ['board', 'list', 'providers'],

  // ── Add future staff here ─────────────────────────────────────────────────
  // 'firstname@internationalrelocationpartner.com': ['board', 'list'],
};

/** Views every unlisted staff member can access. */
export const DEFAULT_ACCESS: DashView[] = ['board', 'list'];

/** The two admin emails who can manage access and see the Admin panel. */
export const ADMIN_EMAILS: string[] = [
  'luisarmando@internationalrelocationpartner.com',
  'pablo@internationalrelocationpartner.com',
];

/**
 * Quote approvers — staff who can approve / request-changes on cotizaciones.
 *
 * Source of truth for Phase 2 approval workflow.
 * Live override: Admin panel → Action Permissions tab → can_approve_quotes.
 * That map takes precedence over this static list when present.
 *
 * Default (static): Marian, Pablo, and Luis.
 */
export const QUOTE_APPROVERS: string[] = [
  'mariancanales@internationalrelocationpartner.com',
  'pablo@internationalrelocationpartner.com',
  'luisarmando@internationalrelocationpartner.com',
];

// ─── Granular Action Permission Keys ─────────────────────────────────────────
//
// Stored in Firestore at  dashboard_config / action_permissions
// Shape: { permissions: Record<email, Record<ActionKey, boolean>> }
//
// Backward compatibility: when that doc is absent, the system falls back to
// the STATIC_ACTION_PERMISSIONS seeds below — zero code breakage.

/** Union of all action-level permission keys. Extend here as new gates are needed. */
export type ActionKey = 'can_approve_quotes';

/** Ordered list used for rendering permission tables in AdminView. */
export const ALL_ACTION_KEYS: ActionKey[] = ['can_approve_quotes'];

/** Human-readable label shown in the Admin UI. */
export const ACTION_KEY_LABELS: Record<ActionKey, string> = {
  can_approve_quotes: 'Aprobar cotizaciones',
};

/** One-line description shown as a tooltip / subtitle in the Admin UI. */
export const ACTION_KEY_DESCRIPTIONS: Record<ActionKey, string> = {
  can_approve_quotes:
    'Puede aprobar o solicitar cambios en cotizaciones enviadas para aprobación.',
};

/**
 * Static seed: which emails start with which action = true.
 * Used to pre-populate the Admin UI when no Firestore doc has been saved yet.
 * As soon as an admin saves, Firestore takes over completely.
 */
export const STATIC_ACTION_PERMISSIONS: Record<ActionKey, string[]> = {
  can_approve_quotes: QUOTE_APPROVERS,
};
