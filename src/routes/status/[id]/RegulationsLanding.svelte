<script lang="ts">
  /**
   * RegulationsLanding.svelte
   *
   * A destination-aware grid of compliance and regulatory navigation cards
   * for the client portal status page.  Each card links to an IRP resource
   * (guide page or Lily deep-link) and is ranked by relevance to the
   * project's destination country.
   *
   * Props
   *   destinationCountry  — free-text country from the project doc
   *   onOpenLily          — optional callback to open the Lily chat drawer
   *                         with a pre-filled prompt
   */

  /** Destination country (used to rank cards and substitute {{destination}} prompts). */
  export let destinationCountry: string = '';
  /** Origin country (used to substitute {{origin}} prompts, e.g. "Export Restrictions"). */
  export let originCountry: string = '';
  export let onOpenLily: ((prompt: string) => void) | null = null;

  // ── Card definitions ──────────────────────────────────────────────────────

  interface RegCard {
    id:           string;
    icon:         string;
    title:        string;
    body:          string;
    /** Which destination countries raise this card's priority (lowercase). */
    priority:     string[];
    /** External guide URL — optional; if present shows the "Read Guide →" CTA. */
    guideUrl?:    string;
    /** Which topic to open Lily with. If set, shows "Ask Lily →" CTA. */
    lilyTopic?:   string;
    /** Pill tag shown in the card header */
    tag?:         string;
    tagColor?:    string;
  }

  const CARDS: RegCard[] = [
    {
      id: 'customs',
      icon: '🛃',
      title: 'Customs & Import Duties',
      tag: 'Compliance',
      tagColor: '#b45309',  /* darkened from #f59e0b (~2.1:1) → #b45309 (~4.8:1) on pale tint */
      body: 'Understand what duties apply to your household goods, electronics, and vehicles when entering your destination country.',
      priority: ['costa rica', 'panama', 'mexico', 'spain', 'portugal', 'colombia', 'argentina', 'peru'],
      guideUrl: '/blog/customs-import-duties',
      lilyTopic: 'What customs duties apply to my household goods shipment to {{destination}}?',
    },
    {
      id: 'vehicle-import',
      icon: '🚗',
      title: 'Vehicle Import Regulations',
      tag: 'Exports',
      tagColor: '#0369a1',  /* darkened from #0ea5e9 (~2.8:1) → #0369a1 (~5.2:1) on pale tint */
      body: 'Rules for importing your car or motorcycle, including year restrictions, emissions standards, and tariff exemptions.',
      priority: ['costa rica', 'panama', 'colombia'],
      guideUrl: '/blog/vehicle-import',
      lilyTopic: 'What are the vehicle import requirements for {{destination}}?',
    },
    {
      id: 'residency',
      icon: '🛂',
      title: 'Residency & Visa Options',
      tag: 'Immigration',
      tagColor: '#0a7e82',  /* darkened from #02b5bb (~2.5:1) → #0a7e82 (~4.7:1) on pale tint */
      body: 'Explore digital nomad visas, pensioner residency programs, investor schemes, and work permit pathways for your destination.',
      priority: ['costa rica', 'portugal', 'spain', 'mexico', 'colombia', 'Panama'],
      lilyTopic: 'What residency or visa options are available for moving to {{destination}}?',
    },
    {
      id: 'tax',
      icon: '💼',
      title: 'Tax Considerations',
      tag: 'Legal',
      tagColor: '#047857',  /* darkened from #10b981 (~2.2:1) → #047857 (~4.7:1) on pale tint */
      body: 'Foreign income taxation, tax treaties, FBAR obligations for US nationals, and VAT implications for expats.',
      priority: ['costa rica', 'portugal', 'spain', 'panama', 'mexico'],
      lilyTopic: 'What are the key tax considerations for a US national moving to {{destination}}?',
    },
    {
      id: 'exemptions',
      icon: '📋',
      title: 'Household Goods Exemptions',
      tag: 'Compliance',
      tagColor: '#b45309',  /* darkened from #f59e0b (~2.1:1) → #b45309 (~4.8:1) on pale tint */
      body: 'Most countries offer duty-free exemptions for used household goods brought by a new resident. Learn the documentation requirements.',
      priority: ['costa rica', 'panama', 'mexico', 'spain', 'colombia', 'argentina'],
      lilyTopic: 'What household goods exemptions apply when I move to {{destination}}?',
    },
    {
      id: 'documents',
      icon: '📄',
      title: 'Documents Checklist',
      tag: 'Services',
      tagColor: '#64748b',
      body: 'A complete list of notarized, sworn, and certified documents you need to prepare before your move.',
      priority: [], // shown for all destinations
      lilyTopic: 'What documents do I need to prepare for an international relocation to {{destination}}?',
    },
    {
      id: 'shipping-export',
      icon: '🚢',
      title: 'Export Restrictions & Controls',
      tag: 'Exports',
      tagColor: '#0369a1',  /* darkened from #0ea5e9 (~2.8:1) → #0369a1 (~5.2:1) on pale tint */
      body: 'US, Canadian, and EU export control rules for electronics, certain household goods, and regulated items going abroad.',
      priority: ['united states', 'canada'],
      lilyTopic: 'Are there any export restrictions I need to know about when shipping from {{origin}}?',
    },
    {
      id: 'insurance',
      icon: '🛡️',
      title: 'Goods-in-Transit Insurance',
      tag: 'Services',
      tagColor: '#64748b',
      body: 'What is and is not covered by standard marine insurance policies, and when you need supplemental coverage.',
      priority: [],
      lilyTopic: 'What insurance coverage do I need for my international shipment?',
    },
  ];

  // ── Ranking logic ─────────────────────────────────────────────────────────

  function rankCards(dest: string): RegCard[] {
    const d = dest.toLowerCase().trim();
    return [...CARDS].sort((a, b) => {
      const aI = a.priority.some(p => d.includes(p) || p.includes(d)) ? 0 : 1;
      const bI = b.priority.some(p => d.includes(p) || p.includes(d)) ? 0 : 1;
      return aI - bI;
    });
  }

  $: ranked = rankCards(destinationCountry);

  // ── Actions ───────────────────────────────────────────────────────────────

  function askLily(card: RegCard) {
    if (!card.lilyTopic || !onOpenLily) return;
    // Replace both {{destination}} and {{origin}} placeholders used in lilyTopic strings.
    // (e.g. the "Export Restrictions" card uses {{origin}} instead of {{destination}})
    const prompt = card.lilyTopic
      .replace(/\{\{destination\}\}/g, destinationCountry || 'my destination')
      .replace(/\{\{origin\}\}/g, originCountry || 'my origin country');
    onOpenLily(prompt);
  }
</script>

<section class="rl">
  <div class="rl__header">
    <h3 class="rl__title">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-highlight-2,#0ea5e9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      Regulations, Exports & Services
    </h3>
    <p class="rl__subtitle">
      Key compliance topics and resources for your
      {#if destinationCountry}<strong>{destinationCountry}</strong> move{:else}international move{/if}.
    </p>
  </div>

  <div class="rl__grid">
    {#each ranked as card (card.id)}
      <div class="rl__card">
        <div class="rl__card-top">
          <span class="rl__icon" role="img">{card.icon}</span>
          {#if card.tag}
            <span
              class="rl__tag"
              style="color:{card.tagColor ?? '#64748b'};background:{(card.tagColor ?? '#64748b') + '18'};border-color:{(card.tagColor ?? '#64748b') + '40'}"
            >{card.tag}</span>
          {/if}
        </div>
        <h4 class="rl__card-title">{card.title}</h4>
        <p class="rl__card-body">{card.body}</p>
        <div class="rl__card-actions">
          {#if card.guideUrl}
            <a
              class="rl__link rl__link--guide"
              href={card.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read Guide
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          {/if}
          {#if card.lilyTopic && onOpenLily}
            <button class="rl__link rl__link--lily" on:click={() => askLily(card)}>
              Ask Lily
              <img src="/lili.png" alt="Lily" class="rl__lily-avatar" />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .rl {
    margin-bottom: 2.5rem;
  }

  /* Header */
  .rl__header {
    margin-bottom: 1.25rem;
  }
  .rl__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-primary, #f1f5f9);
    margin: 0 0 0.35rem;
  }
  .rl__subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #94a3b8);
    margin: 0;
  }
  .rl__subtitle strong {
    color: var(--color-text-primary, #f1f5f9);
  }

  /* List layout */
  .rl__grid {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Item row */
  .rl__card {
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 0;
    padding: 1.1rem 0.25rem;
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    gap: 0.75rem 1rem;
    align-items: start;
    transition: background 0.12s;
  }
  .rl__card:last-child {
    border-bottom: none;
  }
  .rl__card:hover {
    background: rgba(2, 181, 187, 0.03);
  }

  .rl__card-top {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 0;
    grid-column: 1;
    padding-top: 0.1rem;
  }
  .rl__icon {
    font-size: 1.35rem;
    line-height: 1;
  }
  .rl__tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid;
    white-space: nowrap;
  }

  .rl__card-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text-primary, #0f172a);
    margin: 0 0 0.2rem;
    line-height: 1.35;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .rl__card-body {
    font-size: 0.8rem;
    color: var(--color-text-muted, #475569);
    margin: 0;
    line-height: 1.5;
    flex: 1;
  }

  /* Actions */
  .rl__card-actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }
  .rl__link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.3rem 0.7rem;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.12s;
  }
  .rl__link--guide {
    background: rgba(2, 132, 199, 0.08);
    color: #0284c7;
    border: 1px solid rgba(2, 132, 199, 0.2);
  }
  .rl__link--guide:hover { opacity: 0.8; }


  /* Lily button — teal background tint, text darkened to #0a7e82 (~4.7:1) for readability */
  .rl__link--lily {
    background: rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.1);
    color: #0a7e82;   /* darkened from #02b5bb (~2.5:1 on tint) → #0a7e82 (~4.7:1); keeps brand palette */
    border: 1px solid rgba(var(--color-highlight-2-rgb, 2, 181, 187), 0.3);
  }
  .rl__link--lily:hover { opacity: 0.8; }

  .rl__lily-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    .rl__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
