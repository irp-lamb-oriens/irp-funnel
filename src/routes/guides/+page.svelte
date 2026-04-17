<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import './guides.scss';

  export let data: { guides: { slug: string; name: string }[] };
  
  let searchTerm = '';
  
  $: filteredGuides = data.guides.filter(guide => 
    guide.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
</script>

<svelte:head>
  <title>International Relocation Country Guides | IRP</title>
</svelte:head>

<Header />

<div class="guides-index-layout">
  <div class="guides-hero">
    <div class="hero-content">
      <h6>Comprehensive Moving Data</h6>
      <h1>International Relocation <span class="highlight">Country Guides</span></h1>
      <p>Official customs rules, restricted items, and key considerations for your move to almost any country in the world.</p>
      
      <div class="search-container">
        <input type="text" bind:value={searchTerm} placeholder="Search for your destination country..." class="search-input" />
        <div class="search-icon">🔍</div>
      </div>
    </div>
  </div>

  <div class="guides-container">
    {#if data.guides.length === 0}
      <div class="empty-state">
        <p>No guides generated yet. Run the guide generation script to populate this folder.</p>
      </div>
    {:else}
      <div class="guides-grid">
        {#each filteredGuides as guide}
          <a href="/guides/{guide.slug}" class="guide-card">
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
</div>

<Footer />