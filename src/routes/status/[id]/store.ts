import { writable, get } from 'svelte/store';
import { irpStaffToken } from '../../../lib/auth/irpStaff.ts';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.origin.startsWith('http://localhost')) {
      return 'http://localhost:8000';
    }
  }
  return 'https://irp-funnel-server.onrender.com';
}

const API_BASE = getApiUrl();

export const isAuthenticated = writable(false);
export const isCheckingAuth = writable(true);
export const authEmail = writable('');
export const authToken = writable<string | null>(null);

// We store the token in localStorage with a key specific to client portal
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('client_token');
  if (token) authToken.set(token);
}

export const project = writable<any>(null);
export const loading = writable(false);
export const error = writable('');
export const stages = writable<string[]>([]);
export const stageLabels = writable<Record<string, string>>({});

// Generic fetch wrapper. Injects two tokens when available:
//   - `x-client-token`     — the end-customer's client-portal session
//   - `x-dashboard-token`  — the IRP staff dashboard session (for staff bypass)
// The server's `requireClientAuth` middleware accepts either, preferring the
// dashboard token so an organization agent already signed into /dashboard
// transparently authorizes every /api/client-status call without seeing the
// OTP wall.
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const clientToken = get(authToken);
  const staffToken = get(irpStaffToken);

  const headers = new Headers(options.headers);
  if (clientToken) headers.set('x-client-token', clientToken);
  if (staffToken) headers.set('x-dashboard-token', staffToken);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    // Don't auto-logout staff just because a stale per-page client_token
    // happened to fail — only clear the client-portal session.
    if (clientToken) logout();
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

export async function requestClientOTP(email: string, projectId: string): Promise<string> {
  const data = await apiFetch('/api/client-status/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email, projectId })
  });
  return data.message;
}

export async function verifyClientOTP(email: string, projectId: string, code: string): Promise<void> {
  const data = await apiFetch('/api/client-status/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, projectId, code })
  });
  
  if (data.token) {
    authToken.set(data.token);
    authEmail.set(data.email);
    isAuthenticated.set(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('client_token', data.token);
    }
  }
}

export async function checkClientAuth(): Promise<boolean> {
  isCheckingAuth.set(true);
  try {
    const data = await apiFetch('/api/client-status/auth/check');
    if (data.authenticated) {
      isAuthenticated.set(true);
      authEmail.set(data.email);
      isCheckingAuth.set(false);
      return true;
    }
  } catch (err) {
    // silently fail and prompt login
  }
  logout();
  isCheckingAuth.set(false);
  return false;
}

export function logout() {
  isAuthenticated.set(false);
  authEmail.set('');
  authToken.set(null);
  project.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('client_token');
  }
}

export async function fetchProject(projectId: string) {
  loading.set(true);
  error.set('');
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}`);
    project.set(data.project);
    stages.set(data.stages || []);
    stageLabels.set(data.stageLabels || {});
  } catch (err: any) {
    error.set(err.message);
  } finally {
    loading.set(false);
  }
}

// ─── Lily Chat ─────────────────────────────────────────────────────────────

export const lilyMessages = writable<any[]>([]);
export const lilyLoading = writable(false);

/** Load the existing Lily chat thread for this project (status scope). */
export async function loadLilyHistory(projectId: string): Promise<void> {
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}/lily/history`);
    lilyMessages.set(data.thread?.rawTail ?? []);
  } catch { /* silent — empty thread is fine */ }
}

/** Send a message to Lily. Optimistically pushes the user bubble,
 *  then replaces with the authoritative rawTail from the server. */
export async function sendLilyMessage(projectId: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  lilyMessages.update((msgs) => [
    ...msgs,
    { role: 'user', content: message, timestamp: now },
  ]);
  lilyLoading.set(true);
  try {
    const data = await apiFetch(`/api/client-status/project/${projectId}/lily`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    lilyMessages.set(data.rawTail ?? []);
  } catch {
    lilyMessages.update((msgs) => [
      ...msgs,
      {
        role: 'assistant',
        content: "Sorry, I had trouble responding. Please try again.",
        timestamp: new Date().toISOString(),
      },
    ]);
  } finally {
    lilyLoading.set(false);
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addComment(projectId: string, body: string): Promise<void> {
  const data = await apiFetch(`/api/client-status/project/${projectId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (data.comment) {
    project.update((p) =>
      p ? { ...p, statusComments: [...(p.statusComments ?? []), data.comment] } : p,
    );
  }
}

export async function editComment(
  projectId: string,
  commentId: string,
  body: string,
): Promise<void> {
  const data = await apiFetch(
    `/api/client-status/project/${projectId}/comment/${commentId}`,
    { method: 'PATCH', body: JSON.stringify({ body }) },
  );
  if (data.comment) {
    project.update((p) =>
      p
        ? {
            ...p,
            statusComments: (p.statusComments ?? []).map((c: any) =>
              c.id === commentId ? data.comment : c,
            ),
          }
        : p,
    );
  }
}

export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  await apiFetch(`/api/client-status/project/${projectId}/comment/${commentId}`, {
    method: 'DELETE',
  });
  project.update((p) =>
    p
      ? {
          ...p,
          statusComments: (p.statusComments ?? []).filter((c: any) => c.id !== commentId),
        }
      : p,
  );
}

// ─── Stage Ratings ────────────────────────────────────────────────────────────

export async function submitStageRating(
  projectId: string,
  stageKey: string,
  rating: number,
  note?: string,
): Promise<void> {
  const data = await apiFetch(`/api/client-status/project/${projectId}/stage-rating`, {
    method: 'POST',
    body: JSON.stringify({ stageKey, rating, ...(note ? { note } : {}) }),
  });
  if (data.stageRating) {
    project.update((p) =>
      p
        ? {
            ...p,
            stageRatings: { ...(p.stageRatings ?? {}), [stageKey]: data.stageRating },
          }
        : p,
    );
  }
}
