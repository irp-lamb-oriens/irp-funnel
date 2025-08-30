<script lang="ts">
  export let text: string;
  export let url: string | undefined = undefined;
  export let subtitle: string | undefined = undefined;
</script>

<section
  class="hero-section"
  style={url
    ? `background-image: url('${url}'); background-attachment: fixed; background-size: cover;`
    : ''}
>
  <h1>{text}</h1>
  {#if subtitle}
    <p class="hero-subtitle">{subtitle}</p>
  {/if}
</section>

<style lang="scss">
.hero-section {
  width: 100%;
  padding: 10rem 0;
  text-align: center;
  background: var(--color-background, #f8f8f8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  // If background image is set, override background color
  &[style*="background-image"] {
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    background-attachment: fixed;
    background-color: #222; // fallback for image loading
  }

  h1 {
    color: var(--color-highlight-2, #1ccfc9);
    font-size: clamp(2.2rem, 10vw, 5rem);
    font-weight: 800;
    margin: 0;
    // Text shadow for contrast if background image is set
    .hero-section[style*="background-image"] & {
      text-shadow: 0 0 50px var(--color-background-inversion, #000);
    }
  }

  .hero-subtitle {
    color: var(--color-background);
    font-size: clamp(1.2rem, 4vw, 2rem);
    font-weight: 400;
    margin-top: 1.5rem;
    margin-bottom: 0;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.4;
    // Subtitle shadow for contrast if background image is set
    .hero-section[style*="background-image"] & {
      text-shadow: 0 0 30px var(--color-background-inversion, #000);
      color: #fff;
    }
  }
}
</style>
