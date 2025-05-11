<script lang="ts">
  import { onMount, getContext, tick } from "svelte";
  import store from "../../../store.ts";

  let wrapper: HTMLDivElement | undefined;
  let isRevealed = false;
  export let canReveal = true;

  // Get context at top-level (Svelte requirement)
  let scrollContainer: HTMLElement | Window = getContext('scrollContainer') || window;
  let attached = false;

  const seconds = (s: number) =>
    new Promise((resolve) => setTimeout(resolve, s * 1000));

  async function scrollHandler() {
    let scrollPos = 0;
    if (scrollContainer instanceof HTMLElement) {
      scrollPos = scrollContainer.scrollTop;
    } else {
      scrollPos = window.scrollY;
    }
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      let viewportHeight = window.innerHeight;
      if (scrollContainer instanceof HTMLElement) {
        viewportHeight = scrollContainer.clientHeight;
      }
      const visibleHeight =
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      const goingToReveal =
        visibleHeight > 0 && visibleHeight / rect.height >= 0.5;

      console.log('[RevealOnScroll] scroll event', {
        scrollPos,
        scrollContainer,
        wrapper,
        rect,
        viewportHeight,
        visibleHeight,
        goingToReveal,
        isRevealed,
        canReveal
      });

      console.log('[RevealOnScroll] isRevealed set to', isRevealed);

      if (!isRevealed && goingToReveal && canReveal) {
        console.log('[RevealOnScroll] Revealing element', { wrapper });
        await seconds(0.5);
        isRevealed = goingToReveal;
        console.log('[RevealOnScroll] isRevealed set to', isRevealed);
      }
    }
  }

  onMount(async () => {
    // Wait for DOM/context to be ready
    await tick();
    if (!attached) {
      if (scrollContainer instanceof HTMLElement) {
        // console.log('[RevealOnScroll] Attaching scroll event to scrollContainer HTMLElement', scrollContainer);
        scrollContainer.addEventListener("scroll", scrollHandler, { passive: true });
      } else {
        // console.log('[RevealOnScroll] Attaching scroll event to window');
        window.addEventListener("scroll", scrollHandler, { passive: true });
      }
      attached = true;
      await scrollHandler();
    }

    setTimeout(async () => {
      await scrollHandler();
    }, 1000);

    store.subscribe(async () => {
      await scrollHandler();
    });
  });

  $: if (canReveal) {
    (async () => {
      await scrollHandler();
    })();
  }
</script>

<div class="reveal-on-scroll" class:revealed={isRevealed} bind:this={wrapper}>
  <slot revealed={isRevealed}></slot>
</div>

<style lang="scss">
  @use "RevealOnScroll.scss";

  .reveal-on-scroll :global(.reveal-img) {
    opacity: 0 !important;
    transform: translateY(50px) !important;
    transition: opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1) !important;
  }
  .reveal-on-scroll :global(.revealed-img) {
    opacity: 1 !important;
    transform: translateY(0) !important;
    transition: opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1) !important;
  }
</style>
