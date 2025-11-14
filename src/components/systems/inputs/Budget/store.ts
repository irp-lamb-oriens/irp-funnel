import { writable } from 'svelte/store';

export const budgetStore = writable<string | null>(null);
