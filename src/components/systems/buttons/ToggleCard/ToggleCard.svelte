<script lang="ts">
  import TextTypes from "../../texts/TextTypes/TextTypes.svelte";

  export let cardTitle: string;
  export let canReveal = false;
  export let isOpen = false;
  export let expanded = false;
  let contentEl: HTMLDivElement;

  function toggle() {
    isOpen = !isOpen;
    onChange?.(isOpen);
  }

  export let onChange: (isOpen: boolean) => void;
</script>

<div class="card">
  <button
    class="card-header"
    on:click={toggle}
    aria-expanded={isOpen}
    type="button"
  >
    <span>
      <TextTypes type="paragraph">
        {cardTitle.split(" ")[0]}
      </TextTypes>
      <TextTypes type="highlight">
        {cardTitle.split(" ").slice(1).join(" ")}
      </TextTypes>
    </span>
    <span class="arrow" class:open={isOpen}></span>
  </button>
  <div class="content-wrapper" bind:this={contentEl} class:open={isOpen}>
    <div class="content" class:expanded>
      <slot></slot>
    </div>
  </div>
</div>

<style lang="scss">
  .card {
    border-radius: 4px;
    border: 0;
    margin: 1rem 0;
    overflow: hidden;
    box-shadow: 0 0 10px -9px var(--color-background);
    transition: 0.1s;

    &:hover {
      box-shadow: 0 0 5px -5px var(--color-background);
      .arrow {
        border-right: 2px solid var(--color-background);
        border-bottom: 2px solid var(--color-background);
      }
    }
  }

  .card-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    
    border: none;
    padding: 0.5rem 1rem;
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .arrow {
    border-right: 2px solid var(--color-background);
    border-bottom: 2px solid var(--color-background);
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-right: 2px solid #333;
    border-bottom: 2px solid #333;
    transform: rotate(45deg);
    transition: transform 0.5s ease;
  }
  .arrow.open {
    transform: rotate(225deg);
  }

  .content-wrapper {
    overflow: auto;
    height: 0;
    transition: height 0.3s ease;
  }
  .content-wrapper.open {
    height: auto;
  }

  .content {
    padding: 0.5rem 1rem;
    display: grid;
    grid-gap: 1rem;

    &.expanded {
      padding: 0.5rem 1rem 10rem;
    }
  }
</style>
