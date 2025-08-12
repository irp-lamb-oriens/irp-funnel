import { writable } from "svelte/store";

const COLOR_1 = "#02b5bb";
const COLOR_2 = "#02b5bb";

export const themeIndex = writable<number>();
export const foregroundColor = writable<string>(COLOR_1);
export const foregroundColorSnapshot = COLOR_1;
export const complementaryColor = writable<string>(COLOR_2);
export const complementaryColorSnapshot = COLOR_2;
export const isDarkTheme = writable<boolean>(true);
