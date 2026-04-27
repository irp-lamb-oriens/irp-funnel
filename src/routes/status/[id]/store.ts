import { writable } from 'svelte/store';
import { env } from '$env/dynamic/public';

const API_BASE = env.PUBLIC_API_URL || 'http://localhost:8000';

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

// Generic fetch wrapper to inject token
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let token: string | null = null;
  authToken.subscribe(v => token = v)();

  const headers = new Headers(options.headers);
  if (token) headers.set('x-client-token', token);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401) {
    logout();
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
