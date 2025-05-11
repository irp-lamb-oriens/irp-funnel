<script lang="ts">
  import { onMount, getContext, tick } from "svelte";
  import { writable } from "svelte/store";

  let wrapper: HTMLDivElement | null = null; // Changed to null for getElementById
  let isRevealed = writable(false);
  export let canReveal = true;
  const uniqueId = `reveal-on-scroll-${Math.random().toString(36).substring(2, 9)}`;

  // Get context at top-level (Svelte requirement)
  let scrollContainer: HTMLElement | Window =
    getContext("scrollContainer") || window;
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
    if (!wrapper) return; // Add null check for wrapper
    const rect = wrapper.getBoundingClientRect();
    let viewportHeight = window.innerHeight;
    if (scrollContainer instanceof HTMLElement) {
      viewportHeight = scrollContainer.clientHeight;
    }
    const visibleHeight =
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const goingToReveal = visibleHeight > 0;
    console.log("wr", !!wrapper, goingToReveal);

    if (!$isRevealed && goingToReveal && canReveal) {
      await seconds(0.5);
      isRevealed.set(goingToReveal);
    }
  }

  onMount(() => {
    const init = async () => {
      await tick(); // Ensure DOM is ready
      wrapper = document.getElementById(uniqueId) as HTMLDivElement | null;
      console.log("wrapper", wrapper);
      setTimeout(() => {
        scrollHandler(); // Initial check now that wrapper is defined
      }, 1000)

      // Attach listener
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.addEventListener("scroll", scrollHandler);
      } else {
        window.addEventListener("scroll", scrollHandler);
      }
      attached = true; // Mark as attached
    };

    init();

    return () => {
      if (attached) {
        // Only remove if attached
        if (scrollContainer instanceof HTMLElement) {
          scrollContainer.removeEventListener("scroll", scrollHandler);
        } else {
          window.removeEventListener("scroll", scrollHandler);
        }
      }
    };
  });

  // Re-check if canReveal changes
  $: if (canReveal && wrapper) scrollHandler();
  // Re-check if wrapper changes (e.g., after hydration)
  // This reactive statement is less critical now as onMount handles initial wrapper check
  // $: if (wrapper) scrollHandler(); // Can be kept for robustness if wrapper might change later
</script>

<div class="reveal-on-scroll {$isRevealed ? 'revealed' : ''}" id={uniqueId}>
  <slot revealed={$isRevealed}></slot>
</div>

<style lang="scss">
  @use "RevealOnScroll.scss";

  *[class*="reveal-on-scroll"] :global(.reveal-img) {
    opacity: 0;
    transform: translateY(50px);
    transition:
      opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  *[class*="reveal-on-scroll"].revealed :global(.reveal-img) {
    opacity: 1;
    transform: translateY(0);
  }
</style>
