<script lang="ts">
  // Gated "full relocation support" panel shown to authenticated CLIENTS only
  // (never on the public site). This is where the deeper service catalogue
  // lives: the things we deliberately keep out of the public funnel so IRP does
  // not read as competing with its own real-estate / immigration / moving
  // partners. Surfaced once the client is logged into their portal.
  type SupportItem = {
    title: string;
    body: string;
  };

  const items: SupportItem[] = [
    {
      title: 'Immigration advice',
      body: 'The legal pathways for your situation, the categories that actually apply, and the documentation that must be right before you commit.',
    },
    {
      title: 'Settling in',
      body: 'Bank accounts, utilities, a driver\u2019s license, and the everyday administration that follows the move.',
    },
    {
      title: 'Vehicle import',
      body: 'Whether your car makes sense to ship, and the real taxes, parts, and registration costs if it does.',
    },
    {
      title: 'Pet relocation',
      body: 'Veterinary documentation, vaccinations, airline and breed restrictions, and ground transport.',
    },
    {
      title: 'Business & investment',
      body: 'Residency, tax, corporate structure, and banking when your move has to work financially.',
    },
    {
      title: 'International moving',
      body: 'Shipping your household goods, a car, or a container with the duties and paperwork mapped up front.',
    },
  ];
</script>

<section class="support">
  <div class="support__head">
    <h2 class="support__title">Full relocation support</h2>
    <p class="support__lead">
      Everything beyond the move itself, available to you as a client. We keep
      this list inside your portal so it stays between us.
    </p>
  </div>

  <div class="support__grid">
    {#each items as it (it.title)}
      <div class="support__item">
        <h3 class="support__item-title">{it.title}</h3>
        <p class="support__item-body">{it.body}</p>
      </div>
    {/each}
  </div>

  <div class="support__foot">
    <p class="support__foot-note">
      Book a call and we'll map which of these your move actually needs.
    </p>
    <a class="support__cta" href="/consultation">Book a call</a>
  </div>
</section>

<style lang="scss">
  .support {
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
    color: #1a1a2e;
  }

  .support__head {
    margin-bottom: 1.75rem;
  }
  .support__title {
    margin: 0 0 0.6rem;
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #111827;
  }
  .support__lead {
    margin: 0;
    color: #475569;
    line-height: 1.6;
    max-width: 62ch;
  }

  .support__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.75rem;
  }

  .support__item {
    background: #fff;
    border: 1px solid rgba(2, 181, 187, 0.16);
    border-radius: 14px;
    padding: 1.25rem 1.4rem;
  }
  .support__item-title {
    margin: 0 0 0.45rem;
    font-size: 1rem;
    font-weight: 800;
    color: #0f172a;
  }
  .support__item-body {
    margin: 0;
    color: #64748b;
    font-size: 0.94rem;
    line-height: 1.6;
  }

  .support__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(2, 181, 187, 0.14);
  }
  .support__foot-note {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
  }
  .support__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.7rem 1.4rem;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.9rem;
    text-decoration: none;
    background: var(--color-highlight-2, #02b5bb);
    color: #fff;
    transition: filter 0.15s, transform 0.15s;
  }
  .support__cta:hover { filter: brightness(1.06); }
  .support__cta:active { transform: translateY(1px) scale(0.99); }

  @media (max-width: 700px) {
    .support__grid {
      grid-template-columns: 1fr;
    }
  }
</style>