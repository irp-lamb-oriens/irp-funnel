import { writable } from "svelte/store";

// Store for managing state across the new funnel
export const email = writable("");
export const name = writable("");
export const topCountries = writable([""]);
export const funnelType = writable("general");
