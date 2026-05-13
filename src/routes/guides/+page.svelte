<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../components/ui/CountryContentWrapper.svelte';
  import LeadCaptureModal from '../../components/LeadCaptureModal.svelte';
  import { irpStaffIsAuthenticated, checkIrpStaff } from '../../lib/auth/irpStaff.ts';
  import './guides.scss';

  export let data: { guides: { slug: string; name: string }[] };
  
  let searchTerm = '';
  let showModal = false;
  let selectedGuideSlug = '';
  let selectedGuideName = '';
  let hasAccess = false;
  
  onMount(async () => {
    // ─── IRP organization-agent bypass ────────────────────────────────────
    // Staff signed into /dashboard skip the lead-capture wall by default —
    // they can still open the modal on demand via the floating "Audit lead
    // capture" pill (or the `?audit=lead-capture` URL override) so they can
    // assess the mechanism end-to-end.
    const isStaff = await checkIrpStaff();
    if (isStaff) {
      hasAccess = true;
    }

    // ─── Existing public visitor flow ─────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const auditParam = urlParams.get('audit');

    if (emailParam) {
      localStorage.setItem("userEmail", emailParam);
    }

    if (localStorage.getItem("userEmail")) {
      hasAccess = true;
    }

    // Staff-only "audit mode" override — opens the modal even if hasAccess
    // is true so an agent can inspect the form. Ignored for non-staff.
    if (isStaff && auditParam === 'lead-capture') {
      showModal = true;
    }
  });
  
  $: filteredGuides = data.guides.filter(guide => 
    guide.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleGuideClick(event: Event, slug: string, name: string) {
    if (!hasAccess) {
      event.preventDefault();
      selectedGuideSlug = slug;
      selectedGuideName = name;
      showModal = true;
    }
  }

  function handleModalSuccess() {
    hasAccess = true;
    if (selectedGuideSlug) {
      goto(`/guides/${selectedGuideSlug}`);
    }
  }

  /**
   * Staff-only: open the lead-capture modal so an organization agent can
   * audit the wall behavior end-to-end without losing their access.
   * Keeps `selectedGuideSlug` empty so `handleModalSuccess` doesn't
   * navigate them away from the listing after submitting.
   */
  function openLeadCaptureAudit() {
    selectedGuideSlug = '';
    selectedGuideName = '';
    showModal = true;
  }
</script>

<svelte:head>
  <title>International Relocation Country Guides | IRP</title>
</svelte:head>

<Header />

<CountryLayout 
  heroTitle="International Relocation Country Guides" 
  heroSubTitle="Official customs rules, restricted items, and key considerations for your move to almost any country in the world."
  heroUrl="https://images.pexels.com/photos/35085677/pexels-photo-35085677.jpeg"
>
  <CountryContentWrapper>
    <div class="search-container">
      <input type="text" bind:value={searchTerm} placeholder="Search for your destination country..." class="search-input" />
      <div class="search-icon">🔍</div>
    </div>

    <!--
      Staff-only "Audit lead capture" pill. Per centralized auth contract:
      visible only via `display: block` when the visitor is an IRP
      organization agent (`$irpStaffIsAuthenticated === true`). Hidden
      (`display: none`) for every other visitor. Lets agents inspect the
      lead-capture mechanism (the wall they otherwise bypass) end-to-end.
    -->
    <button
      type="button"
      class="staff-audit-pill"
      style="display: {$irpStaffIsAuthenticated ? 'block' : 'none'};"
      title="Open the lead-capture modal to audit how it behaves for a real visitor."
      on:click={openLeadCaptureAudit}
    >
      🔎 Audit lead capture
    </button>

    <div class="guides-container">
      {#if data.guides.length === 0}
        <div class="empty-state">
          <p>No guides generated yet. Run the guide generation script to populate this folder.</p>
        </div>
      {:else}
        <div class="guides-grid">
          {#each filteredGuides as guide}
            <a href="/guides/{guide.slug}" class="guide-card" on:click={(e) => handleGuideClick(e, guide.slug, guide.name)}>
              <div class="card-icon">🌍</div>
              <h3>{guide.name}</h3>
              <p>View customs rules and requirements for relocating to {guide.name}.</p>
              <span class="read-more">Read Guide →</span>
            </a>
          {/each}
          
          {#if filteredGuides.length === 0}
            <div class="no-results">
              <p>No countries found matching "{searchTerm}".</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </CountryContentWrapper>
</CountryLayout>

<LeadCaptureModal 
  bind:show={showModal} 
  destinationCountry={selectedGuideName}
  on:success={handleModalSuccess} 
/>

<Footer />
