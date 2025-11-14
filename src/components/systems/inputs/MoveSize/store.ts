import { writable } from 'svelte/store';

export const moveSizeStore = writable<string | null>(null);
