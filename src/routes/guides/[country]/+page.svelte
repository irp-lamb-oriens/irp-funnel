<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';
  import LeadCaptureModal from '../../../components/LeadCaptureModal.svelte';
  import { irpStaffIsAuthenticated, checkIrpStaff } from '../../../lib/auth/irpStaff.ts';
  import './guide.scss';

  export let data: {
    country: string;
    markdownContent?: string;
    bodyHtml?: string;
    title?: string;
    displayName?: string;
    pdfUrl?: string;
  };


  let htmlContent = "";
  let showModal = false;
  import { browser } from '$app/environment';
    import countries from '../../../components/systems/inputs/Country/countries.ts';

  let hasAccess = false;
  let isCheckingAccess = true;
  
  onMount(async () => {
    // ─── IRP organization-agent bypass ────────────────────────────────────
    // Staff signed into /dashboard skip the lead-capture wall by default
    // and can re-open the modal on demand to assess the lead-capture
    // mechanism (see floating "Audit lead capture" pill below + the
    // `?audit=lead-capture` URL override).
    const isStaff = await checkIrpStaff();

    const urlParams = new URLSearchParams(window.location.search);
    const accessOverride = urlParams.get('access') === 'true';
    const auditParam = urlParams.get('audit');
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      localStorage.setItem("userEmail", emailParam);
    }

    const savedEmail = localStorage.getItem("userEmail");
    
    if (isStaff || savedEmail || accessOverride) {
      hasAccess = true;
    } else {
      showModal = true;
    }

    // Staff-only "audit mode" override — opens the modal even though the
    // staff bypass is granting access, so an agent can inspect the form.
    if (isStaff && auditParam === 'lead-capture') {
      showModal = true;
    }

    isCheckingAccess = false;

    // Prefer CRM-authored HTML (WYSIWYG); fall back to bundled markdown.
    let parsedHtml = data.bodyHtml && data.bodyHtml.trim()
      ? data.bodyHtml
      : (marked(data.markdownContent || '') as string);


    // Add target="_blank" to links, and some base classes to tables safely via regex
    // This avoids compatibility issues with different versions of the `marked` renderer API.
    parsedHtml = parsedHtml.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    parsedHtml = parsedHtml.replace(/<table>/g, '<div class="table-responsive"><table class="modern-table">');
    parsedHtml = parsedHtml.replace(/<\/table>/g, '</table></div>');
    
    htmlContent = parsedHtml;
  });
  
  // Format country name for display — prefer the CRM guide's country label,
  // then the country-code lookup, then the raw route param.
  $: displayName = data.displayName || countries.find(c => c.code === data.country.toUpperCase())?.name || data.country;


  /**
   * Staff-only: open the lead-capture modal so an organization agent can
   * audit the wall behavior end-to-end without losing their access.
   * `hasAccess` is left untouched so submitting the modal won't lock the
   * page back down — the agent stays bypassed.
   */
  function openLeadCaptureAudit() {
    showModal = true;
  }
</script>

<svelte:head>
  <title>{displayName} Relocation Guide | IRP</title>
  <meta name="description" content="{displayName} relocation guide for expats, retirees and digital nomads. Customs rules, restricted items, cost of living, visa steps and preparation checklists for moving to {displayName}." />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="Moving to {displayName} | IRP Relocation Guide" />
  <meta property="og:description" content="Comprehensive {displayName} guide covering customs regulations, restricted and prohibited items, tax and cost of living, local visas, and moving preparation steps." />
  <meta property="og:url" content="https://yourwebsite.com/guides/{country-slug}" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Header />

<CountryLayout 
  heroTitle={`Moving to ${displayName}`} 
  heroSubTitle="A comprehensive overview of customs rules, restricted items, and preparation steps for your international move."
  heroUrl="https://images.pexels.com/photos/28376207/pexels-photo-28376207.jpeg"
>
  <CountryContentWrapper>
    <!--
      Staff-only "Audit lead capture" pill. Per centralized auth contract:
      visible only via `display: block` when the visitor is an IRP
      organization agent (`$irpStaffIsAuthenticated === true`). Hidden
      (`display: none`) for every other visitor. Lets agents re-open the
      lead-capture modal on demand to assess the mechanism end-to-end.
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

    {#if isCheckingAccess}
      <div class="skeleton-loader">
        <div class="skel-line title"></div>
        <div class="skel-line"></div>
        <div class="skel-line"></div>
        <div class="skel-line short"></div>
      </div>
    {:else if !hasAccess}
      <div class="locked-content">
        <div class="icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h2>Content Locked</h2>
        <p>Please enter your email to view this comprehensive relocation guide.</p>
        <button class="unlock-btn" on:click={() => showModal = true}>Unlock Guide</button>
      </div>
    {:else if htmlContent}
      <article class="markdown-body">
        {@html htmlContent}
      </article>
      <br><hr><br>
      <p><em>Disclaimer: The information above is a generalized summary sourced from the IAM Country Guides. Customs rules vary heavily based on personal circumstances, visa status, and changing local laws. This guide does not constitute legal or logistical advice.</em></p>
    {:else}
      <div class="skeleton-loader">
        <div class="skel-line title"></div>
        <div class="skel-line"></div>
        <div class="skel-line"></div>
        <div class="skel-line short"></div>
        <div class="skel-line title-small"></div>
        <div class="skel-line"></div>
        <div class="skel-line short"></div>
      </div>
    {/if}
  </CountryContentWrapper>
</CountryLayout>

<LeadCaptureModal 
  bind:show={showModal} 
  destinationCountry={displayName}
  on:success={() => hasAccess = true} 
/>

<Footer />
