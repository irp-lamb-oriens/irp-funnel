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
export type DashView = 'board' | 'list' | 'metrics' | 'evo' | 'providers' | 'posts' | 'admin' | 'templates';
export declare const ALL_VIEWS: DashView[];
/**
 * Static fallback access map.
 * Emails NOT listed here fall back to DEFAULT_ACCESS.
 */
export declare const STATIC_SECTION_ACCESS: Record<string, DashView[]>;
/** Views every unlisted staff member can access. */
export declare const DEFAULT_ACCESS: DashView[];
/** The two admin emails who can manage access and see the Admin panel. */
export declare const ADMIN_EMAILS: string[];
/**
 * Quote approvers — staff who can approve / request-changes on cotizaciones.
 *
 * Source of truth for Phase 2 approval workflow.
 * Live override: Admin panel → Action Permissions tab → can_approve_quotes.
 * That map takes precedence over this static list when present.
 *
 * Default (static): Marian, Pablo, and Luis.
 */
export declare const QUOTE_APPROVERS: string[];
/** Union of all action-level permission keys. Extend here as new gates are needed. */
export type ActionKey = 'can_approve_quotes';
/** Ordered list used for rendering permission tables in AdminView. */
export declare const ALL_ACTION_KEYS: ActionKey[];
/** Human-readable label shown in the Admin UI. */
export declare const ACTION_KEY_LABELS: Record<ActionKey, string>;
/** One-line description shown as a tooltip / subtitle in the Admin UI. */
export declare const ACTION_KEY_DESCRIPTIONS: Record<ActionKey, string>;
/**
 * Static seed: which emails start with which action = true.
 * Used to pre-populate the Admin UI when no Firestore doc has been saved yet.
 * As soon as an admin saves, Firestore takes over completely.
 */
export declare const STATIC_ACTION_PERMISSIONS: Record<ActionKey, string[]>;
