<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../components/ui/CountryContentWrapper.svelte';
  import LeadCaptureModal from '../../components/LeadCaptureModal.svelte';
  import './guides.scss';

  export let data: { guides: { slug: string; name: string }[] };
  
  let searchTerm = '';
  let showModal = false;
  let selectedGuideSlug = '';
  let selectedGuideName = '';
  let hasAccess = false;
  
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      localStorage.setItem("userEmail", emailParam);
    }

    if (localStorage.getItem("userEmail")) {
      hasAccess = true;
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
