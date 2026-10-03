<script lang="ts">
  import copy from './copy.json';

  const { title, subtitle, subBaja } = copy;
</script>

<section class="personality-showcase">
  <div class="personality-showcase__grid">
    <figure class="personality-showcase__media">
      <img src="/assets/pablo.png" alt="Pablo" />
    </figure>

    <div class="personality-showcase__copy">
      <h2 class="personality-showcase__title">{title}</h2>
      <p class="personality-showcase__subtitle">{subtitle}</p>
      <p class="personality-showcase__sub-baja">{subBaja}</p>
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
    color: rgba(2, 13, 16, 0.7);
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