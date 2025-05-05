import { writable } from "svelte/store";

const COLOR_1 = "#03a9f4";
const COLOR_2 = "#f24e02";

export const themeIndex = writable<number>();
export const foregroundColor = writable<string>(COLOR_1);
export const foregroundColorSnapshot = COLOR_1;
export const complementaryColor = writable<string>(COLOR_2);
export const complementaryColorSnapshot = COLOR_2;
export const isDarkTheme = writable<boolean>(true);
