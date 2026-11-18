<script lang="ts">
  /**
   * Country guides index ("the atlas"). Built on the home's visual system
   * (components/landing/_tokens.scss): an ink hero with a turning globe and
   * a search that steers it, the six chapters every guide carries, the A to Z
   * index with a sticky globe lens, and a close back to booking.
   * Sections live in components/guides; per-guide data in lib/data/guide-atlas.ts.
   *
   * Lead capture is unchanged: visitors without an email on file get the
   * LeadCaptureModal before a guide opens; IRP staff skip it and can audit it.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import LeadCaptureModal from '../../components/LeadCaptureModal.svelte';
  import AtlasHero from '../../components/guides/AtlasHero.svelte';
  import AtlasChapters from '../../components/guides/AtlasChapters.svelte';
  import AtlasIndex from '../../components/guides/AtlasIndex.svelte';
  import AtlasClose from '../../components/guides/AtlasClose.svelte';
  import { atlasEntry, type AtlasEntry } from '../../lib/data/guide-atlas.ts';
  import { irpStaffIsAuthenticated, checkIrpStaff } from '../../lib/auth/irpStaff.ts';
  import './guides.scss';

  export let data: { guides: { slug: string; name: string }[] };

  const guides: AtlasEntry[] = data.guides
    .map((g) => atlasEntry(g.slug, g.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  let query = '';
  let showModal = false;
  let selectedGuideSlug = '';
  let selectedGuideName = '';
  let hasAccess = false;

  onMount(async () => {
    // ─── IRP organization-agent bypass ────────────────────────────────────
    // Staff signed into /dashboard skip the lead-capture wall by default —
    // they can still open the modal on demand via the floating "Audit lead
    // capture" pill (or the `?audit=lead-capture` URL override).
    const isStaff = await checkIrpStaff();
    if (isStaff) hasAccess = true;

    // ─── Public visitor flow ──────────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const auditParam = urlParams.get('audit');
    const q = urlParams.get('q');
    if (q) query = q;

    if (emailParam) localStorage.setItem('userEmail', emailParam);
    if (localStorage.getItem('userEmail')) hasAccess = true;

    if (isStaff && auditParam === 'lead-capture') showModal = true;
  });

  /** Open a guide; without access, ask for the email first. `e` is null for keyboard opens (Enter in the search). */
  function openGuide(e: Event | null, g: AtlasEntry) {
    if (!hasAccess) {
      e?.preventDefault();
      selectedGuideSlug = g.slug;
      selectedGuideName = g.name;
      showModal = true;
      return;
    }
    if (!e) goto(`/guides/${g.slug}`);
  }

  function handleModalSuccess() {
    hasAccess = true;
    if (selectedGuideSlug) goto(`/guides/${selectedGuideSlug}`);
  }

  /** Staff-only: open the lead-capture modal to audit the wall without leaving the listing. */
  function openLeadCaptureAudit() {
    selectedGuideSlug = '';
    selectedGuideName = '';
    showModal = true;
  }

  const itemList = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'International relocation country guides',
    numberOfItems: guides.length,
    itemListElement: guides.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${g.name} relocation and customs guide`,
      url: `https://internationalrelocationpartner.com/guides/${g.slug}`
    }))
  });
</script>

<svelte:head>
  <title>Country Guides: Customs Rules for {guides.length} Countries | IRP</title>
  <meta name="description" content="Customs rules for household goods, vehicles, pets, restricted and prohibited items in {guides.length} countries. Free relocation guides from International Relocation Partner." />
  <meta property="og:title" content="Country guides: customs rules for {guides.length} countries" />
  <meta property="og:description" content="What customs asks for, what it taxes and what it refuses: household goods, cars and pets, country by country." />
  <link rel="preload" href="/landing/land-dots.json" as="fetch" crossorigin="anonymous" />
  {@html '<scr' + 'ipt type="application/ld+json">' + itemList + '</scr' + 'ipt>'}
</svelte:head>

<Header />

<main id="main-content" class="atlas">
  <AtlasHero {guides} bind:query open={openGuide} />
  <AtlasChapters />
  <AtlasIndex {guides} bind:query open={openGuide} />
  <AtlasClose />
</main>

<!--
  Staff-only "Audit lead capture" pill: visible only when an IRP organization
  agent is signed in (`$irpStaffIsAuthenticated`). Opens the modal so agents can
  inspect the lead-capture wall they otherwise bypass.
-->
<button
  type="button"
  class="staff-audit-pill"
  style="display: {$irpStaffIsAuthenticated ? 'block' : 'none'};"
  title="Open the lead-capture modal to audit how it behaves for a real visitor."
  on:click={openLeadCaptureAudit}
>
  Audit lead capture
</button>

<LeadCaptureModal bind:show={showModal} destinationCountry={selectedGuideName} on:success={handleModalSuccess} />

<Footer />

<style>
  .atlas {
    overflow-x: clip;
    --font-paragraph: 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif;
    font-family: var(--font-paragraph);
  }
  /* The site globals give every element the paragraph font directly; inside the
     atlas, elements inherit so the mono labels and the sans headings hold. */
  :global(.atlas *) { font-family: inherit; }
</style>
