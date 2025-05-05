import { onMount } from "svelte";
import { get, writable } from "svelte/store";
import { playTick } from "../audioInteractions";

export const ticks: HTMLElement[] = [];
export const itemHovered = writable<HTMLElement>();

export function startTicks() {
  onMount(() => {
    window.addEventListener("mouseover", () => {
      ticks.forEach((item) => {
        if (
          (item?.matches(":hover") || item?.matches(":focus")) &&
          get(itemHovered) !== item
        ) {
          itemHovered.set(item);
          playTick();
        }
      });
    });

    ticks.forEach((tick) => {
      tick?.addEventListener("focus", () => {
        playTick();
      });
      tick?.addEventListener("click", () => {
        playTick();
        tick?.blur();
      });
    });
  });
}
