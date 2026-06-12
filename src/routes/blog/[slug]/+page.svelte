<script lang="ts">
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';
  import type { BlogArticle } from './+page.ts';

  export let data: { article: BlogArticle };

  $: article = data.article;

  // Plain-text excerpt for the meta description (first ~160 chars).
  $: metaDescription = (article?.bodyHtml ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  // Local, brand-owned hero asset (exists in /static). Avoids external/404 risk.
  const HERO_FALLBACK = '/about-bg.jpg';
</script>

<svelte:head>
  <title>{article ? `${article.title} | IRP` : 'Guide | IRP'}</title>
  {#if metaDescription}
    <meta name="description" content={metaDescription} />
  {/if}
</svelte:head>

<Header />

<CountryLayout heroTitle={article ? article.title : 'Guide'} heroUrl={HERO_FALLBACK}>
  <CountryContentWrapper>
    <article class="blog-detail">
      {#if article}
        <div class="blog-header">
          <h1>{article.title}</h1>
          {#if article.updatedAt}
            <p class="blog-meta">Updated {formatDate(article.updatedAt)}</p>
          {/if}
        </div>

        <div class="blog-content">{@html article.bodyHtml}</div>

        <div class="blog-footer">
          <a href="/guides" class="back-link">← Browse all relocation guides</a>
        </div>
      {:else}
        <div class="error">Guide not found.</div>
      {/if}
    </article>
  </CountryContentWrapper>
</CountryLayout>

<Footer />

<style lang="scss">
  /* Cohesive with the IRP design system — uses global brand tokens
     (--color-highlight-2 teal, --color-foreground text) and brand fonts. */
  .blog-detail {
    max-width: 760px;
    margin: 0 auto;
    padding: 0.5rem 0 1rem;
  }

  .blog-header {
    margin-bottom: 2rem;
    padding-bottom: 1.25rem;
    border-bottom: 2px solid rgba(var(--color-highlight-2-rgb), 0.18);
  }
  .blog-header h1 {
    font-family: var(--font-title);
    color: var(--color-highlight-2);
    font-size: clamp(1.9rem, 4vw, 2.6rem);
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: 0.01em;
    margin: 0 0 0.85rem;
  }
  .blog-meta {
    display: inline-block;
    color: var(--color-highlight-2);
    background: rgba(var(--color-highlight-2-rgb), 0.1);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 999px;
    margin: 0;
  }

  .blog-content {
    font-family: var(--font-paragraph);
    font-size: 1.08rem;
    line-height: 1.8;
    color: var(--color-foreground);
  }
  .blog-content :global(h2) {
    font-family: var(--font-title);
    color: var(--color-foreground);
    font-size: 1.55rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 2.4rem 0 0.85rem;
    padding-left: 0.85rem;
    border-left: 4px solid var(--color-highlight-2);
  }
  .blog-content :global(h3) {
    font-family: var(--font-title);
    color: var(--color-foreground);
    font-size: 1.22rem;
    font-weight: 700;
    margin: 1.8rem 0 0.6rem;
  }
  .blog-content :global(p) {
    margin: 0 0 1.15rem;
    color: var(--color-foreground);
  }
  .blog-content :global(strong) {
    color: var(--color-foreground);
    font-weight: 700;
  }
  .blog-content :global(ul),
  .blog-content :global(ol) {
    margin: 0 0 1.15rem 1.4rem;
  }
  .blog-content :global(li) {
    margin: 0.4rem 0;
  }
  .blog-content :global(li)::marker {
    color: var(--color-highlight-2);
  }
  .blog-content :global(a) {
    color: var(--color-highlight-2);
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--color-highlight-2-rgb), 0.4);
    transition: color 0.2s, border-color 0.2s;
  }
  .blog-content :global(a:hover) {
    border-bottom-color: var(--color-highlight-2);
  }
  .blog-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
    margin: 1.25rem 0;
  }
  .blog-content :global(blockquote) {
    border-left: 4px solid var(--color-highlight-2);
    margin: 1.5rem 0;
    padding: 0.85rem 1.25rem;
    background: rgba(var(--color-highlight-2-rgb), 0.07);
    border-radius: 0 8px 8px 0;
    color: var(--color-foreground);
    font-style: italic;
  }

  .blog-footer {
    margin-top: 2.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--color-highlight-2);
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.95rem;
    padding: 0.6rem 1.3rem;
    border-radius: 999px;
    box-shadow: 0 4px 14px rgba(var(--color-highlight-2-rgb), 0.3);
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .back-link:hover {
    background: #019fa4;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(var(--color-highlight-2-rgb), 0.4);
  }

  .error {
    color: var(--color-highlight-1);
    text-align: center;
    padding: 2rem 0;
  }

  @media (max-width: 640px) {
    .blog-content {
      font-size: 1rem;
    }
  }
</style>
