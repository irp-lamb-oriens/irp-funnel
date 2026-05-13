/**
 * irpStaff.ts — Centralized authentication state for IRP organization agents.
 *
 * This module is the single source of truth for "is the current visitor an
 * IRP organization agent?" across the whole funnel app. Any page that has a
 * sign-in wall (e.g. /dashboard, /status/[id], /guides) reads from these
 * stores so that a staff member already signed into /dashboard transparently
 * bypasses every wall — no second OTP, no second token.
 *
 * Backed by the existing `dashboard_token` / `dashboard_email` localStorage
 * keys so there is no token migration. The /dashboard page already writes to
 * these keys when staff sign in via OTP.
 *
 * Server-side, the dashboard token is sent in the `x-dashboard-token` header.
 * The clientStatusRouter middleware also accepts this header for staff bypass.
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/** The email domain that grants IRP organization-agent privileges. */
export const IRP_STAFF_DOMAIN = 'internationalrelocationpartner.com';

/** localStorage keys, kept in sync with dashboard's existing keys. */
const TOKEN_KEY = 'dashboard_token';
const EMAIL_KEY = 'dashboard_email';

// ─── Stores ─────────────────────────────────────────────────────────────────

/** The dashboard session token (a hex string from the dashboard OTP flow). */
export const irpStaffToken = writable<string | null>(
  browser ? localStorage.getItem(TOKEN_KEY) : null
);

/** The signed-in staff email (e.g. agent@internationalrelocationpartner.com). */
export const irpStaffEmail = writable<string | null>(
  browser ? localStorage.getItem(EMAIL_KEY) : null
);

/**
 * True iff `checkIrpStaff()` has confirmed the dashboard session is still
 * valid on the server. Defaults to false; `checkIrpStaff()` flips it.
 */
export const irpStaffIsAuthenticated = writable<boolean>(false);

/**
 * True while `checkIrpStaff()` is in flight on initial page mount. Pages
 * should keep their wall in a "loading" state until this becomes false to
 * avoid the wall flashing for staff who *are* signed in.
 */
export const isCheckingIrpStaff = writable<boolean>(true);

// Persist token + email to localStorage on every change.
if (browser) {
  irpStaffToken.subscribe((val) => {
    if (val) localStorage.setItem(TOKEN_KEY, val);
    else localStorage.removeItem(TOKEN_KEY);
  });
  irpStaffEmail.subscribe((val) => {
    if (val) localStorage.setItem(EMAIL_KEY, val);
    else localStorage.removeItem(EMAIL_KEY);
  });
}

// ─── API base resolution ────────────────────────────────────────────────────

/**
 * Resolves the IRP funnel server URL. localhost in dev, render.com in prod.
 * Mirrors the per-route helpers in dashboard/store.ts and status/[id]/store.ts.
 */
export function getApiUrl(): string {
  if (browser && window.location.origin.startsWith('http://localhost')) {
    return 'http://localhost:8000';
  }
  return 'https://irp-funnel-server.onrender.com';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check whether the locally stored dashboard token still resolves to a valid
 * server-side session. Updates `irpStaffIsAuthenticated`,
 * `irpStaffEmail`, and `isCheckingIrpStaff` accordingly.
 *
 * Never throws — on any error or 401 the staff stores are quietly cleared so
 * the calling page can fall back to its public/anonymous wall flow.
 *
 *   // Use a relative path with `.ts` extension (matching the codebase style):
 *   //   import { checkIrpStaff, irpStaffIsAuthenticated } from '../../lib/auth/irpStaff.ts';
 *   onMount(async () => {
 *     const isStaff = await checkIrpStaff();
 *     if (isStaff) { /* skip the wall */ /* }
 *   });
 */
export async function checkIrpStaff(): Promise<boolean> {
  if (!browser) {
    isCheckingIrpStaff.set(false);
    return false;
  }
  const token = get(irpStaffToken);
  if (!token) {
    irpStaffIsAuthenticated.set(false);
    isCheckingIrpStaff.set(false);
    return false;
  }
  try {
    const res = await fetch(`${getApiUrl()}/api/dashboard/auth/check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-dashboard-token': token,
      },
    });
    if (!res.ok) {
      // Session expired or invalid — clear it silently.
      clearIrpStaff();
      return false;
    }
    // Server confirms session. Some endpoints may also return the email.
    try {
      const data = await res.json();
      if (data?.email && typeof data.email === 'string') {
        irpStaffEmail.set(data.email);
      }
    } catch {
      // If the response isn't JSON, that's fine — token is still valid.
    }
    irpStaffIsAuthenticated.set(true);
    return true;
  } catch {
    // Network blip — assume not authenticated for this page render but
    // don't wipe the token (could just be a transient outage).
    irpStaffIsAuthenticated.set(false);
    return false;
  } finally {
    isCheckingIrpStaff.set(false);
  }
}

/**
 * Wipe the staff session everywhere — localStorage, all stores. Use this in
 * any "Log Out" button that should sign the agent out of *every* IRP page.
 */
export function clearIrpStaff(): void {
  irpStaffToken.set(null);
  irpStaffEmail.set(null);
  irpStaffIsAuthenticated.set(false);
}

/**
 * Persist a freshly issued staff session (called by the /dashboard OTP flow
 * after `verify-otp` succeeds). Equivalent to setting the three stores in a
 * single transaction.
 */
export function setIrpStaffSession(token: string, email: string): void {
  irpStaffToken.set(token);
  irpStaffEmail.set(email);
  irpStaffIsAuthenticated.set(true);
  isCheckingIrpStaff.set(false);
}
