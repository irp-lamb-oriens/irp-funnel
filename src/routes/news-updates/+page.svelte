<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import NewsCard from '../../components/NewsCard.svelte';
  import './news-updates.scss';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  // Pagination constants
  const LIMIT = 9;

  // Get page index from query params (default 0)
  let pageIndex = 0;
  $: {
    const url = $page.url;
    const pageParam = url.searchParams.get('page');
    pageIndex = pageParam ? parseInt(pageParam) : 0;
  }

  let blogs: any[] = [];
  let total = 0;
  let loading = true;

  // Fetch blogs from CosmicJS API
  async function fetchBlogs() {
    loading = true;
    const skip = LIMIT * pageIndex;
    const apiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22type%22:%22blogs%22%7D&limit=${LIMIT}&skip=${skip}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    blogs = data.objects || [];
    total = data.total || 0;
    loading = false;
  }

  // Generate excerpt from HTML content
  function getExcerpt(html: string, maxLength = 180) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    if (text.length <= maxLength) return text;
    // Try to cut at the last space before maxLength
    const cut = text.lastIndexOf(' ', maxLength);
    return text.slice(0, cut > 0 ? cut : maxLength) + '...';
  }

  // Animation state for pagination
  let animating: 'newer' | 'older' | null = null;
  let pendingPage: number | null = null;

  function goToPage(newPage: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', newPage.toString());
    window.location.search = params.toString();
  }

  function handlePaginate(direction: 'newer' | 'older') {
    if (animating) return;
    animating = direction;
    pendingPage = direction === 'newer' ? pageIndex - 1 : pageIndex + 1;
    setTimeout(() => {
      animating = null;
      if (pendingPage !== null) {
        goToPage(pendingPage);
        pendingPage = null;
      }
    }, 420); // match animation duration
  }

  $: $page, fetchBlogs();

</script>

<Header />

<CountryLayout heroTitle="News" heroUrl="https://images.pexels.com/photos/10464468/pexels-photo-10464468.jpeg?w=2000">
  <section class="news-list">
    {#if loading}
      <div class="loading">Loading...</div>
    {:else}
      <div class="news-grid">
        {#each blogs as blog}
          <NewsCard
            imageSrc={blog.metadata?.poster?.imgix_url || blog.metadata?.poster?.url || ''}
            imageAlt={blog.title}
            title={blog.title}
            excerpt={getExcerpt(blog.metadata?.title)}
            link={`/news-updates/blog?slug=${blog.slug}&page=${pageIndex}`}
            readMoreText="read more"
          />
        {/each}
      </div>
      <div class="pagination">
        <button
          class="pagination-btn newer {animating === 'newer' ? 'animating' : ''}"
          on:click={() => handlePaginate('newer')}
          disabled={pageIndex === 0 || animating}
        >
          « Newer Entries
        </button>
        <span>Page {pageIndex + 1} of {Math.ceil(total / LIMIT)}</span>
        <button
          class="pagination-btn older {animating === 'older' ? 'animating' : ''}"
          on:click={() => handlePaginate('older')}
          disabled={(LIMIT * (pageIndex + 1)) >= total || animating}
        >
          Older Entries »
        </button>
      </div>
    {/if}
  </section>
</CountryLayout>

<Footer />

<style>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 2.5rem;
}
.pagination-btn {
  background: none;
  border: none;
  color: #222;
  font-size: 1rem;
  padding: 0.5em 1.2em;
  border-radius: 999px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: background 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1);
  outline: none;
  min-width: 120px;
}
.pagination-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.pagination-btn:not(:disabled):hover {
  background: #f3f3f3;
  color: #0077cc;
}
.pagination-btn.animating.newer {
  animation: slideLeft 0.45s cubic-bezier(0.4,0,0.2,1) forwards;
}
.pagination-btn.animating.older {
  animation: slideRight 0.45s cubic-bezier(0.4,0,0.2,1) forwards;
}
@keyframes slideLeft {
  0% { transform: translateX(0); opacity: 1; }
  60% { transform: translateX(-16px); opacity: 0.7; }
  100% { transform: translateX(-32px); opacity: 0; }
}
@keyframes slideRight {
  0% { transform: translateX(0); opacity: 1; }
  60% { transform: translateX(16px); opacity: 0.7; }
  100% { transform: translateX(32px); opacity: 0; }
}
</style>
