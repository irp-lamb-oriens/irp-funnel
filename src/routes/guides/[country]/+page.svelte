<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';
  import './guide.scss';

  export let data: { country: string; markdownContent: string };

  let htmlContent = "";
  
  onMount(() => {
    // Parse markdown into HTML when component mounts
    // Add target="_blank" to links, and some base classes to tables
    const renderer = new marked.Renderer();
    renderer.link = function(href, title, text) {
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" title="' + (title || '') + '">' + text + '</a>';
    };
    renderer.table = function(header, body) {
      return '<div class="table-responsive"><table class="modern-table"><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
    };
    
    htmlContent = marked(data.markdownContent, { renderer }) as string;
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
    {#if htmlContent}
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

<Footer />