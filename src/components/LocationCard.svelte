<script lang="ts">
  import LetterByLetter from "./LetterByLetter.svelte";

  export let country: string;
  export let details: Array<{
    label: string;
    address: string;
    email?: string;
    emailHref?: string;
    extra?: string;
    imgAlt: string;
  }>;
  export let open: boolean;
  export let onToggle: () => void;
  export let tabIndex: number = 0;
  // Helper to strip HTML tags for LetterByLetter animation
  function stripHtml(html: string): string {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // Generate 12 shadow configs: [background, transition-duration]
  const shadowConfigs = Array.from({ length: 12 }, (_, i) => {
    // Opacity fades from 0.22 to 0.02, duration from 0.7s to 0s
    const opacity = 0.22 - i * 0.018;
    const duration = (0.7 - i * 0.06).toFixed(2) + "s";
    const color = `rgba(2,181,187,${opacity.toFixed(2)})`;
    return [color, duration];
  });
</script>

<div
  class="location-card {open ? 'location-card--open' : ''}"
  tabindex={tabIndex}
  role="button"
  aria-expanded={open}
  on:click={onToggle}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // stop Space from also scrolling the page
      onToggle();
    }
  }}
>
  <!-- Multi-layered animated shadows for hover/focus, using Svelte {#each} -->
  {#each shadowConfigs as [bg, duration], i}
    <span class="location-card__shadow shadow{ i + 1 }"></span>
  {/each}
  <div class="location-card__header">
    <h5 class="location-card__country">{country}</h5>
    <!-- Removed arrow/triangle -->
  </div>
  <div class="location-card__content {open ? 'location-card__content--open' : ''}">
    {#if open}
      {#each details as detail}
        <div class="location-card__detail">
          <img class="location-card__img" src="./icons/map.png" alt={detail.imgAlt} />
          <div class="location-card__info">
            {#if detail.label}
              <h5 class="location-card__label">
                <LetterByLetter text={detail.label} />
              </h5>
            {/if}
            <p class="location-card__address">
              <LetterByLetter text={stripHtml(detail.address)} />
            </p>
            {#if detail.extra}
              <p class="location-card__extra">
                <LetterByLetter text={stripHtml(detail.extra)} />
              </p>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
$shadow-count: 12;
$shadow-base-color: #02b5bb;
$shadow-base-opacity: 0.22;
$shadow-min-opacity: 0.02;
$shadow-base-duration: 0.7s;
$shadow-min-duration: 0s;

.location-card {
  border-radius: 0;
  background: transparent;
  padding: 1.2rem 1.1rem;
  color: #f7fafd;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  cursor: pointer;
  outline: none;
  border-bottom: 1px solid rgba(220,230,255,0.22);
  transition:
    box-shadow 0.18s cubic-bezier(0.4,0,0.2,1),
    background 0.18s cubic-bezier(0.4,0,0.2,1);
  box-shadow: none;
  background: transparent;
  transform: none;
  z-index: 1;
  position: relative;
  overflow: hidden;

  // Multi-layered animated shadows for hover/focus (inspired by CountryButton)
  @for $i from 1 through $shadow-count {
    $opacity: $shadow-base-opacity - ($i - 1) * (($shadow-base-opacity - $shadow-min-opacity) / ($shadow-count - 1));
    $duration: $shadow-base-duration - ($i - 1) * (($shadow-base-duration - $shadow-min-duration) / ($shadow-count - 1));
    .shadow#{$i} {
      position: absolute;
      left: 0; top: 0; height: 100%; width: 0%;
      pointer-events: none;
      z-index: 0;
      border-radius: 0;
      background: rgba(2,181,187, $opacity);
      clip-path: polygon(0 100%, 0 100%, 100% 100%, 0 100%);
      transition-timing-function: cubic-bezier(.4,-1.6,.6,1);
      transition-property: width, clip-path;
      transition-duration: $duration;
    }
  }

  &:hover:not(.location-card--open),
  &:focus:not(.location-card--open) {
    box-shadow: none;
    background: transparent;
    z-index: 2;
    color: #fff;
    @for $i from 1 through $shadow-count {
      $hover-duration: ($i - 1) * (1.8s / ($shadow-count - 1));
      .shadow#{$i} {
        width: 100%;
        clip-path: polygon(0 0, 0 100%, 100% 100%, 100% 0);
        transition-duration: $hover-duration;
      }
    }
    .location-card__label,
    .location-card__country,
    .location-card__address,
    .location-card__extra {
      color: #fff !important;
    }
  }

  .location-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .location-card__country {
      margin: 0;
      color: #fff;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      position: relative;
      z-index: 2;
    }
  }

  .location-card__content {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    margin-top: 0;
    transition:
      opacity 0.18s,
      max-height 0.22s cubic-bezier(0.4,0,0.2,1),
      margin-top 0.18s;
    &--open {
      opacity: 1;
      max-height: 800px;
      margin-top: 0.7rem;
      transition:
        max-height 0.22s cubic-bezier(0.4,0,0.2,1),
        opacity 0.18s,
        margin-top 0.18s;
    }
  }

  .location-card__detail {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.7rem;

    .location-card__img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.08);
    }
    .location-card__info {
      flex: 1 1 0;
      text-align-last: left;
  .location-card__label {
    color: #fff;
    font-size: 1.05rem;
    font-weight: 700;
    margin-bottom: 0.2rem;
    letter-spacing: 0.01em;
    position: relative;
    z-index: 2;
  }
  .location-card__address {
    font-size: 1rem;
    color: #fff;
    margin-bottom: 0.3rem;
    position: relative;
    z-index: 2;
  }
  .location-card__extra {
    font-size: 0.98rem;
    color: #fff;
    margin-bottom: 0.2rem;
    position: relative;
    z-index: 2;
  }
    }
  }

  &.location-card--open {
    background: transparent;
    z-index: 3;
  }
}

.location-card:last-child {
  border-bottom: none;
}
</style>
