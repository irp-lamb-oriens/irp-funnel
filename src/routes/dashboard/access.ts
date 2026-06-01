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
 * Live override: Admin panel can set `quote_approvers` key in Firestore
 * dashboard_config/staff_access; that list takes precedence when present.
 *
 * Default (static): Marian, Pablo, and Luis.
 */
export const QUOTE_APPROVERS: string[] = [
  'mariancanales@internationalrelocationpartner.com',
  'pablo@internationalrelocationpartner.com',
  'luisarmando@internationalrelocationpartner.com',
];
