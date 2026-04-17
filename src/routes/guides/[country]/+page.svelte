<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';
  import LeadCaptureModal from '../../../components/LeadCaptureModal.svelte';
  import './guide.scss';

  export let data: { country: string; markdownContent: string };

  let htmlContent = "";
  let showModal = false;
  import { browser } from '$app/environment';

  let hasAccess = false;
  let isCheckingAccess = true;
  
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessOverride = urlParams.get('access') === 'true';
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      localStorage.setItem("userEmail", emailParam);
    }

    const savedEmail = localStorage.getItem("userEmail");
    
    if (!savedEmail && !accessOverride) {
      showModal = true;
    } else {
      hasAccess = true;
    }
    
    isCheckingAccess = false;

    // Parse markdown into HTML when component mounts
    let parsedHtml = marked(data.markdownContent) as string;
    
    // Add target="_blank" to links, and some base classes to tables safely via regex
    // This avoids compatibility issues with different versions of the `marked` renderer API.
    parsedHtml = parsedHtml.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    parsedHtml = parsedHtml.replace(/<table>/g, '<div class="table-responsive"><table class="modern-table">');
    parsedHtml = parsedHtml.replace(/<\/table>/g, '</table></div>');
    
    htmlContent = parsedHtml;
  });
  
  // Format country name for display
  $: displayName = data.country.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
</script>

<svelte:head>
  <title>{displayName} Relocation Guide | IRP</title>
</svelte:head>

<Header />

<CountryLayout 
  heroTitle={`Moving to ${displayName}`} 
  heroSubTitle="A comprehensive overview of customs rules, restricted items, and preparation steps for your international move."
  heroUrl="https://images.pexels.com/photos/834958/pexels-photo-834958.jpeg?w=2000"
>
  <CountryContentWrapper>
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