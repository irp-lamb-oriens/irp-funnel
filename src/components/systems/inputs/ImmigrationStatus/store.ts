import { writable } from 'svelte/store';

export const immigrationStatusStore = writable<string | null>(null);
