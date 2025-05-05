<script lang="ts">
  import MarkdownText from "../../texts/MarkdownText/MarkdownText.svelte";
  import SVG from "../../../SVG/SVG.svelte";

  export let label: string = "";
  export let svg: string = "user-gear-solid";
  export let selected = false;
  export let canReveal = false;

  // 'collapsed' determines whether the card is in its compact state.
  export let collapsed = false;

  // Toggle collapse when the title button is clicked.
  function toggleCollapse() {
    collapsed = !collapsed;
    // When expanding, stagger the reveal of card-body children after a 500ms delay.
    if (!collapsed) {
      const cardBody = document.querySelector(".card-body");
      if (cardBody) {
        const children = Array.from(cardBody.children);
        children.forEach((child, index) => {
          child.classList.remove("visible");
          child.classList.add("hidden");
          setTimeout(
            () => {
              child.classList.remove("hidden");
              child.classList.add("visible");
            },
            500 + index * 100
          ); // 500ms delay + stagger for each child.
        });
      }
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card {selected ? 'selected' : ''} {collapsed
    ? 'collapsed'
    : 'expanded'}"
  on:click|stopPropagation={toggleCollapse}
  aria-expanded={!collapsed}
>
  <div class="card-title">
    <button
      type="button"
      class="card-title-button"
      aria-expanded={!collapsed}
      on:click|stopPropagation={toggleCollapse}
    >
      <span class="card-title-text {collapsed ? 'hidden' : 'visible'}">
        <MarkdownText {canReveal}>## {label}</MarkdownText>
      </span>
      <span class="card-title-icon {collapsed ? 'visible' : 'hidden'}">
        <SVG src="icons/{svg}.svg" />
      </span>
    </button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="card-body" on:click|stopPropagation>
    <slot />
  </div>
</div>

<style lang="scss">
  .card {
    background: var(--color-x-gradient-opaque);
    backdrop-filter: blur(6px);
    border-radius: 7px;
    padding: 1rem 2rem;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 0 10px -6.5px var(--color-background);
    max-height: 100%;
    position: sticky;
    top: 0;
    padding-bottom: 150px;
    margin-bottom: 25px;
    /* Horizontal expansion: expanded state happens immediately, collapsed state waits 0.5s */
    &.expanded {
      overflow: auto;
      width: 100%;
      transition:
        transform 0.6s ease,
        box-shadow 0.6s ease,
        border-color 0.6s ease,
        width 0.4s ease 0.3s,
        height 0.4s ease 0.3s,
        overflow 0s ease 0.6s;
    }

    &.collapsed {
      padding: 1rem 3rem;
      width: 150px; /* Adjust as needed */
      height: 150px; /* Square ratio */
      transition:
        transform 0.3s ease,
        box-shadow 0.3s ease,
        border-color 0.3s ease,
        width 0.4s ease 0.5s,
        height 0.4s ease 0.5s,
        padding 0.4s ease 0.5s,
        overflow 0.4s ease;
    }
  }

  .card:hover {
    box-shadow: 0 0 10px -3px var(--color-background);
  }

  .card.selected {
    box-shadow: 0 0 10px -2px var(--color-foreground);
  }

  .card-title {
    margin-bottom: 1rem;
  }

  .card-title-button {
    all: unset;
    cursor: pointer;
    display: flex;
    
    justify-content: space-between;
    width: 100%;
  }

  .card-title-text,
  .card-title-icon {
    transition:
      opacity 0.4s ease 0.5s,
      width 0s ease 0.4s;
    width: auto;
  }

  .card-title-text.hidden,
  .card-title-icon.hidden {
    transition:
      opacity 0.4s ease 0s,
      width 0s ease 0.4s;
    opacity: 0;
    width: 0;
    height: 125px;

    :global(svg) {
      transition:
        width 0.3s ease 0.3s,
        opacity 0.3s ease 0s;
      width: 0%;
      opacity: 0;
    }
  }

  .card-title-text.visible,
  .card-title-icon.visible {
    transition: opacity 1s ease 1s;
    opacity: 1;

    :global(svg) {
      width: 100%;
      opacity: 1;
      transition:
        width 1s ease 0s,
        opacity 1s ease 1s;
    }
  }

  /* The card-body container collapses vertically with a 500ms delay when expanding */
  .card.expanded .card-body {
    transition:
      max-height 0.4s ease 0.5s,
      opacity 0.4s ease 0.5s;
    max-height: 100vh; /* Adjust based on expected content height */
    opacity: 1;
    overflow: auto;
  }

  .card.collapsed .card-body {
    overflow: hidden;
    transition:
      max-height 0.4s ease 0s,
      opacity 0.4s ease 0s;
    max-height: 0;
    opacity: 0;
  }

  /* Each child inside card-body will also transition its opacity and vertical position */
  .card-body > * {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }
  .card-body > *.visible {
    opacity: 1;
    transform: translateY(0);
  }
</style>
