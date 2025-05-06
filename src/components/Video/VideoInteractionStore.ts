import { writable } from "svelte/store";

export type VideoEvent =
  | { type: "timeupdate"; currentTime: number }
  | { type: "ended" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "interaction" };

export const videoInteractionStore = writable<VideoEvent | null>(null);
