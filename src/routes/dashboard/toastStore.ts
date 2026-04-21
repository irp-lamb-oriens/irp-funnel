/**
 * toastStore.ts — Svelte store for toast notifications in the dashboard.
 * Supports success, error, and info types with auto-dismiss.
 */
import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add(type: Toast['type'], message: string, duration = 4000) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, type, message, duration };

    update(toasts => [...toasts, toast]);

    // Auto-dismiss
    setTimeout(() => {
      dismiss(id);
    }, duration);

    return id;
  }

  function dismiss(id: string) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (message: string, duration?: number) => add('success', message, duration),
    error: (message: string, duration?: number) => add('error', message, duration ?? 6000),
    info: (message: string, duration?: number) => add('info', message, duration),
    dismiss,
  };
}

export const toasts = createToastStore();
