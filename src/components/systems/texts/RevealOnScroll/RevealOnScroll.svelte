<script lang="ts">
  import { onMount } from "svelte";
  import store from "../../../store.ts";

  // Define the wrapper element with proper typing
  let wrapper: HTMLDivElement | undefined;
  // Track reveal state
  let isRevealed = false;

  export let canReveal = true;

  // Store the scroll handler for cleanup
  let scrollHandler: () => void;

  const seconds = (s: number) =>
    new Promise((resolve) => setTimeout(resolve, s * 1000));

  scrollHandler = async () => {
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      // Calculate visible height of the element
      const visibleHeight =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      // Reveal when at least 1% of the element is visible
      const goingToReveal =
        visibleHeight > 0 && visibleHeight / rect.height >= 0.5;

      if (!isRevealed && goingToReveal && canReveal) {
        window.removeEventListener("scroll", scrollHandler);
        await seconds(0.5);
        isRevealed = goingToReveal;
      }
    }
  };
  function isScrollable(el: Element) {
    const style = getComputedStyle(el);
    return (
      (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) &&
      (style.overflow === "auto" ||
        style.overflow === "scroll" ||
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflowX === "auto" ||
        style.overflowX === "scroll")
    );
  }
  // Check initially in case the element is already in view
  onMount(async () => {
    setTimeout(async () => {
      await scrollHandler();
    }, 1000);

    await scrollHandler();

    store.subscribe(async () => {
      await scrollHandler();
    });
    // Add scroll event listener

    const allElements = document.querySelectorAll("*");
    allElements.forEach((el) => {
      if (isScrollable(el)) {
        el.addEventListener("scroll", async () => {
          await scrollHandler();
        });
      }
    });
  });

  $: if (canReveal) {
    (async () => {
      await scrollHandler();
    })();
  }
</script>

<div class="reveal-on-scroll" class:revealed={isRevealed} bind:this={wrapper}>
  <slot></slot>
</div>

<style lang="scss">
  @use "RevealOnScroll.scss";
</style>
