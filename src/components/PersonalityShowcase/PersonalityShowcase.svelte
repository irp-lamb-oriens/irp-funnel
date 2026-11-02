<script lang="ts">
  import copy from './copy.json';

  const { title, subtitle, subBaja } = copy;
</script>

<!-- First paint of the homepage: this portrait is the likely LCP element, so it
     is fetched at high priority with explicit dimensions (no layout shift). -->
<section class="personality-showcase" aria-labelledby="personality-showcase-title">
  <div class="personality-showcase__grid">
    <figure class="personality-showcase__media">
      <img
        src="/assets/pablo.png"
        alt="Portrait of {title}"
        width="402"
        height="402"
        fetchpriority="high"
        decoding="async"
      />
    </figure>

    <div class="personality-showcase__copy">
      <h2 class="personality-showcase__title" id="personality-showcase-title">{title}</h2>
      <p class="personality-showcase__subtitle">{subtitle}</p>
      <p class="personality-showcase__sub-baja">{subBaja}</p>
      <!-- One gesture to the conversion path: the booking form sits right below. -->
      <a class="personality-showcase__next" href="#hero-form">
        Plan your move with Pablo's team
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  </div>
</section>

<style lang="scss">
  .personality-showcase {
    position: relative;
    width: 100%;
    background: var(--color-highlight-2, #02b5bb);
    color: #020d10;
    overflow: hidden;
  }

  .personality-showcase__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: end;
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .personality-showcase__media {
    margin: 0;
    align-self: end;
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;

    img {
      display: block;
      width: 100%;
      max-width: 520px;
      height: auto;
      object-fit: contain;
      object-position: bottom left;
    }
  }

  .personality-showcase__copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    align-self: center;
    text-align: center;
    gap: 1rem;
    padding: 4rem 2rem;
  }

  .personality-showcase__title {
    margin: 0;
    font-family: var(--font-title, serif);
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: #020d10;
  }

  .personality-showcase__subtitle {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.6;
    color: rgba(2, 13, 16, 0.82);
    max-width: 46ch;
    margin-inline: auto;
  }

  .personality-showcase__sub-baja {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgba(2, 13, 16, 0.78);
  }

  .personality-showcase__next {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.7rem 1.2rem;
    border-radius: 999px;
    border: 1.5px solid rgba(2, 13, 16, 0.85);
    color: #020d10;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: background-color 0.2s ease, color 0.2s ease;

    span {
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    &:hover {
      background: #020d10;
      color: #fff;
    }
    &:hover span {
      transform: translateY(3px);
    }
    &:focus-visible {
      outline: 2px solid #020d10;
      outline-offset: 3px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .personality-showcase__next,
    .personality-showcase__next span {
      transition: none;
    }
    .personality-showcase__next:hover span {
      transform: none;
    }
  }

  @media (max-width: 768px) {
    .personality-showcase__grid {
      grid-template-columns: 1fr;
      align-items: stretch;
      padding: 0 1.5rem;
    }

    .personality-showcase__copy {
      order: 1;
      padding: 3rem 0 2rem;
    }

    .personality-showcase__media {
      order: 2;
      justify-content: center;

      img {
        max-width: 100%;
      }
    }
  }
</style>