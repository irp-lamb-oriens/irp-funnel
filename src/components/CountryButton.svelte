<script lang="ts">
    import { writable } from "svelte/store";

  export let text: string;
  export let url: string;
  export let shadowLayers: number = 4;
  let hovered = writable(false);

  // Each shadow config: [spread, opacity, delay, duration]
  const shadowConfigs = [
    [0, 0.18, 0, 0.18],
    [8, 0.22, 0.08, 0.22],
    [16, 0.28, 0.16, 0.28],
    [24, 0.36, 0.28, 0.36]
  ];
</script>

<a
  class="country-btn"
  href={url}
  onmouseenter={() => hovered.set(true)}
  onmouseleave={() => hovered.set(false)}
  onfocus={() => hovered.set(true)}
  onblur={() => hovered.set(false)}
>
  {#each shadowConfigs.slice(0, shadowLayers) as [spread, opacity, delay, duration], i}
    <span
      class="country-btn__shadow shadow{ i + 1 }"
      class:show={$hovered}
    ></span>
  {/each}
  <span class="country-btn__text">{text}</span>
</a>

<style lang="scss">
.country-btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 1.1em 0.5em;
  background: transparent;
  border-radius: 0;
  color: #fff;
  text-align: center;
  font-weight: 700;
  font-size: clamp(1rem, 1vw + 0.8rem, 1.18rem);
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  transition: color 0.18s;
  box-shadow: none;
  outline: none;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.country-btn__text {
  position: relative;
  z-index: 2;
}

.country-btn__shadow {
  position: absolute;
  left: 0; top: 0; width: 0%; height: 100%;
  pointer-events: none;
  z-index: 1;
  border-radius: 0;
  transition: 1s;
  transition-timing-function: cubic-bezier(.4,-1.6,.6,1);
  background: #02b5bbaa;
  clip-path: polygon(0 100%, 0 100%, 100% 100%, 0 100%);
}
  .shadow1 {
    transition: 0.9s;
  }
  .shadow2 {
    transition: 0.3s;
  }
  .shadow3 {
    transition: 0.1s;
  }
  .shadow4 {
    transition: 0s;
  }
.show {
  width: 100%;
  clip-path: polygon(0 0, 0 100%, 100% 100%, 100% 0);

  &.shadow1 {
    transition: 0s;
  }
  &.shadow2 {
    transition: 0.2s;
  }
  &.shadow3 {
    transition: 0.6s;
  }
  &.shadow4 {
    transition: 1.8s;
  }
}

.country-btn:hover,
.country-btn:focus {
  color: #fff;
  text-decoration: none;
}
</style>
