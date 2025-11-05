<script lang="ts">
  import { onMount } from 'svelte';

  export let title: string;
  export let lastUpdated: string;

  let headings: { id: string; text: string }[] = [];
  let mainContent: HTMLElement;

  onMount(() => {
    if (mainContent) {
      const headingNodes = mainContent.querySelectorAll('h2');
      headings = Array.from(headingNodes).map((node) => {
        const id = node.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        node.id = id || '';
        return {
          id: id || '',
          text: node.textContent || '',
        };
      });
    }
  });
</script>

<div class="legal-page-container">
  <aside class="toc-sidebar">
    <nav>
      <h3>On this page</h3>
      <ul>
        {#each headings as heading}
          <li><a href="#{heading.id}">{heading.text}</a></li>
        {/each}
      </ul>
    </nav>
  </aside>

  <main class="main-content" bind:this={mainContent}>
    <header class="page-header">
      <h1>{title}</h1>
      <p class="last-updated">Last updated: {lastUpdated}</p>
    </header>
    <div class="content-body">
      <slot />
    </div>
  </main>
</div>

<style>
  .legal-page-container {
    display: flex;
    gap: 2rem;
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: sans-serif;
  }

  .toc-sidebar {
    width: 250px;
    flex-shrink: 0;
    position: sticky;
    top: 2rem;
    height: calc(100vh - 4rem);
    overflow-y: auto;
  }

  .toc-sidebar h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .toc-sidebar ul {
    list-style: none;
    padding: 0;
    margin: 0;
    border-left: 1px solid #e2e8f0;
  }

  .toc-sidebar li a {
    display: block;
    padding: 0.5rem 1rem;
    color: #4a5568;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .toc-sidebar li a:hover {
    color: #2d3748;
    background-color: #f7fafc;
  }

  .main-content {
    flex-grow: 1;
    min-width: 0; /* Prevents flexbox overflow issues */
    top: 82px;
    position: relative;
  }

  .page-header {
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 1rem;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .last-updated {
    color: #718096;
    font-size: 0.9rem;
  }

  .content-body :global(h2) {
    font-size: 1.75rem;
    font-weight: 600;
    margin-top: 3rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .content-body :global(p),
  .content-body :global(ul) {
    line-height: 1.6;
    color: #4a5568;
    margin-bottom: 1rem;
  }
  
  .content-body :global(ul) {
    padding-left: 1.5rem;
  }

  .content-body :global(strong) {
    font-weight: 600;
    color: #2d3748;
  }

  .content-body :global(a) {
    color: #4299e1;
    text-decoration: none;
  }

  .content-body :global(a:hover) {
    text-decoration: underline;
  }

  /* TLDR Box */
  .content-body :global(.tldr) {
    background-color: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .content-body :global(.tldr h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 1rem;
  }
</style>
