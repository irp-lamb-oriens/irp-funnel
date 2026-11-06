<script lang="ts">
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
    import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';

  let slug = '';
  let type = '';
  let pageIndex = 0;
  let blog: any = null;
  let loading = true;

  const RENDER_API_URL = "https://ai-newsletter-translated.onrender.com";

  $: {
    const url = $page.url;
    slug = url.searchParams.get('slug') || '';
    type = url.searchParams.get('type') || '';
    pageIndex = parseInt(url.searchParams.get('page') || '0');
  }

  function transformRenderArticle(apiArticle: any) {
    const imageMatch = apiArticle.content.match(/<img[^>]+src="([^">]+)"/);
    const imageUrl = imageMatch ? imageMatch[1] : '';
    const mainContent = apiArticle.content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "");

    return {
      title: apiArticle.title,
      metadata: {
        title: mainContent,
        poster: {
          imgix_url: imageUrl,
          url: imageUrl
        }
      }
    };
  }

  async function fetchBlog() {
    if (!slug) return;
    loading = true;

    if (type === 'render') {
      const apiUrl = `${RENDER_API_URL}/article/${slug}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      blog = transformRenderArticle(data);
    } else {
      const apiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22slug%22:%22${slug}%22%7D&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      blog = data.objects && data.objects.length > 0 ? data.objects[0] : null;
    }
    
    loading = false;
  }

  $: $page, fetchBlog();
</script>

<Header />

<CountryLayout
  heroTitle={blog ? blog.title : 'Blog'}
  heroEyebrow="News & guides"
  heroUrl={blog?.metadata?.poster?.imgix_url || blog?.metadata?.poster?.url || 'https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg?w=2000'}
>
  <CountryContentWrapper>
    <section class="blog-detail">
      <a href={`/news-updates?page=${pageIndex}`} class="back-link back-link--top">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
        All articles
      </a>
      {#if loading}
        <div class="loading" aria-busy="true" aria-label="Loading article">
          <span class="sk sk--w90"></span><span class="sk"></span><span class="sk sk--w70"></span>
          <span class="sk sk--gap"></span><span class="sk"></span><span class="sk sk--w80"></span>
        </div>
      {:else if blog}
        <!-- The title is the page's <h1> in the hero above. -->
        <div class="blog-content">{@html blog.metadata?.title || ''}</div>
        <div class="blog-foot">
          <a href={`/news-updates?page=${pageIndex}`} class="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            Back to News
          </a>
        </div>
      {:else}
        <div class="error">
          <p class="error__title">We couldn’t find that article.</p>
          <p>It may have moved. The full list is on the News page.</p>
        </div>
      {/if}
    </section>
  </CountryContentWrapper>
</CountryLayout>

<Footer />

<style lang="scss">
  $ink: #0e2f36;
  $teal: #02b5bb;
  $teal-deep: #04767b;
  $text: #2b3a3e;
  $steel: #4a5c61;
  $canvas: #f6f9f9;
  $mist: #eef8f8;
  $hair: rgba(14, 47, 54, 0.1);
  $sans: 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', sans-serif;

  .blog-detail {
    max-width: 720px;
    margin: 0 auto;
    font-family: $sans;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0 1.1rem;
    border-radius: 999px;
    border: 1px solid $hair;
    color: $ink;
    font: 600 0.95rem $sans;
    text-decoration: none;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    &:hover {
      background: $ink;
      border-color: $ink;
      color: #fff;
    }
    &:focus-visible {
      outline: 2px solid $teal;
      outline-offset: 3px;
    }
  }
  .back-link--top {
    margin-bottom: 2.25rem;
  }
  .blog-foot {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid $hair;
  }

  // Article body arrives as CMS HTML.
  .blog-content {
    font: 400 1.125rem/1.75 $sans;
    color: $text;
    :global(p),
    :global(li) {
      font-family: $sans;
      font-size: 1.125rem;
      line-height: 1.75;
      color: $text;
    }
    :global(p) {
      margin: 0 0 1.2rem;
    }
    :global(h1),
    :global(h2) {
      font: 700 clamp(1.5rem, 2.6vw, 2rem) / 1.15 $sans;
      letter-spacing: -0.03em;
      color: $ink;
      margin: 2.75rem 0 1rem;
    }
    :global(h3),
    :global(h4) {
      font: 700 clamp(1.2rem, 1.8vw, 1.4rem) / 1.25 $sans;
      letter-spacing: -0.02em;
      color: $ink;
      margin: 2.25rem 0 0.8rem;
    }
    :global(strong),
    :global(b) {
      color: $ink;
      font-weight: 600;
    }
    :global(a) {
      color: $teal-deep;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    :global(img) {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 18px;
      margin: 2rem 0;
    }
    :global(ul),
    :global(ol) {
      padding-left: 1.25rem;
      margin: 0 0 1.4rem;
    }
    :global(li) {
      margin: 0.4rem 0;
    }
    :global(blockquote) {
      margin: 2rem 0;
      padding: 1.25rem 1.5rem;
      border-left: 3px solid $teal;
      background: $canvas;
      border-radius: 0 14px 14px 0;
      color: $ink;
    }
    :global(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 1rem;
    }
    :global(th),
    :global(td) {
      text-align: left;
      padding: 0.7rem 0.8rem;
      border-bottom: 1px solid $hair;
    }
  }

  .loading {
    display: grid;
    gap: 0.8rem;
  }
  .sk {
    display: block;
    height: 1rem;
    border-radius: 6px;
    background: $canvas;
    animation: blog-shimmer 1.4s ease-in-out infinite;
  }
  .sk--w90 { width: 90%; }
  .sk--w80 { width: 80%; }
  .sk--w70 { width: 70%; }
  .sk--gap { margin-top: 1rem; }

  .error {
    padding: 2rem;
    border-radius: 20px;
    background: $canvas;
    border: 1px solid $hair;
    color: $steel;
    .error__title {
      margin: 0 0 0.4rem;
      color: $ink;
      font-weight: 700;
      font-size: 1.2rem;
    }
    p {
      margin: 0;
    }
  }

  @keyframes blog-shimmer {
    50% { opacity: 0.5; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sk { animation: none; }
  }
</style>
