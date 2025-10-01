<script lang="ts">
  import Header from "../../components/Header/Header.svelte";
  import Footer from "../../components/Footer/Footer.svelte";
  import CountryLayout from "../../components/ui/CountryLayout.svelte";
  import NewsCard from "../../components/NewsCard.svelte";
  import "./news-updates.scss";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";

  let pageIndex = 0;
  $: pageIndex = $page.url.searchParams.get("page") ? parseInt($page.url.searchParams.get("page")!) : 0;

  // Pagination constants
  const LIMIT = 9;

  let blogs: any[] = [];
  let total = 0;
  let cosmicTotal = 0;
  let renderTotal = 0;
  let loading = true;
  let initialLoadComplete = false;

  const articlesCache = new Map<number, any[]>();

  // Search state and filtering
  let search = "";
  let searchFocused = false;
  let searchTouched = false;

  // Filter logic
  $: filteredBlogs = search
    ? blogs.filter(blog =>
        blog.title?.toLowerCase().trim().includes(search.toLowerCase().trim())
      )
    : blogs;
  $: isSearching = search.length > 0;
  $: showPagination = !isSearching;

  async function initialLoad() {
    console.log("Initiating primary source load (CosmicJS)...");
    loading = true;
    try {
      // Fetch Cosmic total and the first page of articles in one go
      const skip = LIMIT * pageIndex;
      const cosmicApiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22type%22:%22blogs%22%7D&limit=${LIMIT}&skip=${skip}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
      const cosmicRes = await fetch(cosmicApiUrl);
      const cosmicData = await cosmicRes.json();

      cosmicTotal = cosmicData.total || 0;
      total = cosmicTotal; // Set initial total based on Cosmic

      const firstPageBlogs = cosmicData.objects || [];
      blogs = firstPageBlogs;
      articlesCache.set(pageIndex, firstPageBlogs);
      console.log("Primary source (CosmicJS) loaded successfully.");

    } catch (e) {
      console.error("Error during initial load", e);
    } finally {
      loading = false; // Show content to the user
      initialLoadComplete = true; // Allow reactive updates for subsequent page changes
      
      // Now fetch the secondary source total in the background
      fetchSecondaryTotal(); 
    }
  }

  async function fetchSecondaryTotal() {
    console.log("Fetching secondary source total (Render API) in the background...");
    try {
      const apiUrl = "https://ai-newsletter-translated.onrender.com";
      const email = "consultation%40internationalrelocationpartner.com";
      const renderApiUrl = new URL(`${apiUrl}/articles?holder=${email}`);
      renderApiUrl.searchParams.set("lang", "en");
      renderApiUrl.searchParams.set("page_en", "0");
      renderApiUrl.searchParams.set("size", "1");
      const renderRes = await fetch(renderApiUrl.toString());
      if (renderRes.ok) {
        const renderData = await renderRes.json();
        if (renderData.articles && renderData.articles["en"]) {
          const { totalWithImages, totalWithoutImages } = renderData.articles["en"];
          const actualRenderTotal = totalWithImages + totalWithoutImages;
          renderTotal = Math.min(actualRenderTotal, LIMIT); // Only one page of render articles
          total = cosmicTotal + renderTotal; // This will reactively update the UI
          console.log("Secondary source (Render API) total loaded. Total updated to:", total);
        }
      }
    } catch (e) {
      console.error("Error fetching secondary total", e);
    }
  }

  async function fetchPageData(pageToFetch: number): Promise<any[]> {
    const cosmicPages = cosmicTotal > 0 ? Math.ceil(cosmicTotal / LIMIT) : 0;
    // Fetch last page of CosmicJS and first page of Render API
    const skip = LIMIT * pageToFetch;
    const cosmicApiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22type%22:%22blogs%22%7D&limit=${LIMIT}&skip=${skip}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
    const cosmicRes = await fetch(cosmicApiUrl);
    const cosmicData = await cosmicRes.json();
    const cosmicBlogs = cosmicData.objects || [];

    const renderPageIndex = 0;
    const apiUrl = "https://ai-newsletter-translated.onrender.com";
    const email = "consultation@internationalrelocationpartner.com";
    const localApiUrl = new URL(`${apiUrl}/articles/${email}`);
    console.log("localApiUrl", localApiUrl)
    localApiUrl.searchParams.set("email", email);
    localApiUrl.searchParams.set("lang", "en");
    localApiUrl.searchParams.set(`page_en`, renderPageIndex.toString());
    localApiUrl.searchParams.set("size", (LIMIT - cosmicBlogs.length).toString());

    const localRes = await fetch(localApiUrl.toString());
    let renderBlogs: any[] = [];
    if (localRes.ok) {
      const localData = await localRes.json();
      if (localData.articles && localData.articles["en"]) {
        const { withImages, withoutImages } = localData.articles["en"];
        renderBlogs = [...withImages, ...withoutImages].map(article => ({
          slug: article.id,
          title: article.title,
          metadata: {
            title: article.content,
            poster: null // Or map some image if available
          },
          type: "blogs" // Assuming same type for consistency
        }));
      }
    }
    return [...cosmicBlogs, ...renderBlogs];
  }

  async function fetchAndCachePage(pageToFetch: number) {
    if (articlesCache.has(pageToFetch)) {
      console.log(`Returning page ${pageToFetch} from cache.`);
      return articlesCache.get(pageToFetch);
    }

    console.log(`Fetching page ${pageToFetch} from network.`);
    const pageData = await fetchPageData(pageToFetch);
    articlesCache.set(pageToFetch, pageData);
    return pageData;
  }

  async function loadAndDisplayPage(page: number) {
    console.log(`Displaying page ${page}...`);
    if (articlesCache.has(page)) {
      blogs = articlesCache.get(page)!;
      return;
    }

    loading = true;
    try {
      const pageData = await fetchAndCachePage(page);
      blogs = pageData || [];

      // Prefetch sibling pages
      const totalPages = Math.ceil(total / LIMIT);
      if (page > 0) {
        fetchAndCachePage(page - 1).catch(e => console.error("Prefetch previous failed:", e));
      }
      if (page < totalPages - 1) {
        fetchAndCachePage(page + 1).catch(e => console.error("Prefetch next failed:", e));
      }
    } catch (err) {
      console.error("Error fetching article list.", err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    initialLoad();
  });

  $: if (browser && initialLoadComplete) {
    loadAndDisplayPage(pageIndex);
  }

  // Generate excerpt from HTML content
  function getExcerpt(html: string, maxLength = 180) {
    if (typeof document === "undefined" || !html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    if (text.length <= maxLength) return text;
    // Try to cut at the last space before maxLength
    const cut = text.lastIndexOf(" ", maxLength);
    return text.slice(0, cut > 0 ? cut : maxLength) + "...";
  }

  // Animation state for pagination
  let animating: "newer" | "older" | null = null;
  let pendingPage: number | null = null;

  function goToPage(newPage: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set("page", newPage.toString());
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function handlePaginate(direction: "newer" | "older") {
    if (animating) return;

    animating = direction;
    pendingPage = direction === "newer" ? pageIndex - 1 : pageIndex + 1;
    setTimeout(() => {
        animating = null;
        if (pendingPage !== null) {
            goToPage(pendingPage);
            pendingPage = null;
        }
    }, 420); // match animation duration
  }
</script>

<Header />

<CountryLayout heroTitle="News" heroUrl="https://images.pexels.com/photos/10464468/pexels-photo-10464468.jpeg?w=2000">
  <section class="news-list">
    <div class="search-bar-wrap">
      <div class="search-bar {searchFocused ? "focused" : ""} {searchTouched && !search ? "empty" : ""}">
        <svg class="search-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="10" cy="10" r="8" stroke="#bbb" stroke-width="2"/>
          <line x1="16.2" y1="16.2" x2="21" y2="21" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search news updates…"
          bind:value={search}
          on:focus={() => { searchFocused = true; searchTouched = true; }}
          on:blur={() => { searchFocused = false; }}
          class="search-input"
          autocomplete="off"
        />
        {#if search}
          <button class="clear-btn" on:click={() => { search = ""; }} aria-label="Clear search">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="4" y1="4" x2="14" y2="14" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>
              <line x1="14" y1="4" x2="4" y2="14" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
    {#if loading}
      <div class="loading">Loading...</div>
    {:else}
      {#if isSearching}
       {#if filteredBlogs.length === 0}
          <div class="no-results">No news found for "<span>{search}</span>"</div>
        {/if}
      {/if}
      {#if showPagination}
        <div class="pagination">
          <button
            class="pagination-btn newer {animating === "newer" ? "animating" : ""}"
            on:click={() => handlePaginate("newer")}
            disabled={pageIndex === 0 || !!animating}
          >
            &laquo; Newer Entries
          </button>
          <span>Page {pageIndex + 1} of {Math.ceil(total / LIMIT)}</span>
          <button
            class="pagination-btn older {animating === "older" ? "animating" : ""}"
            on:click={() => handlePaginate("older")}
            disabled={(LIMIT * (pageIndex + 1)) >= total || !!animating}
          >
            Older Entries &raquo;
          </button>
        </div>
      {/if}
      <div class="news-grid">
        {#each filteredBlogs as blog (blog.slug)}
          <div class="news-card-anim">
            <NewsCard
              imageSrc={blog.metadata?.poster?.imgix_url || blog.metadata?.poster?.url || ""}
              imageAlt={blog.title}
              title={blog.title}
              excerpt={getExcerpt(blog.metadata?.title)}
              link={`/news-updates/blog?slug=${blog.slug}&page=${pageIndex}`}
              readMoreText="read more"
            />
          </div>
        {/each}
      </div>
      {#if showPagination}
        <div class="pagination">
          <button
            class="pagination-btn newer {animating === "newer" ? "animating" : ""}"
            on:click={() => handlePaginate("newer")}
            disabled={pageIndex === 0 || !!animating}
          >
            &laquo; Newer Entries
          </button>
          <span>Page {pageIndex + 1} of {Math.ceil(total / LIMIT)}</span>
          <button
            class="pagination-btn older {animating === "older" ? "animating" : ""}"
            on:click={() => handlePaginate("older")}
            disabled={(LIMIT * (pageIndex + 1)) >= total || !!animating}
          >
            Older Entries &raquo;
          </button>
        </div>
      {/if}
    {/if}
  </section>
</CountryLayout>

<Footer />

<style>
/* Search bar styles */
.search-bar-wrap {
  display: flex;
  justify-content: center;
  margin: 0rem auto 10rem;
  animation: fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1);
  z-index: 20;
  background: rgba(255,255,255,0.97);
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  /* Add a smooth transition for shadow when sticky */
  transition: box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s cubic-bezier(0.4,0,0.2,1);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(18px);}
  to { opacity: 1; transform: translateY(0);}
}
.search-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 2.5em;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.07);
  padding: 0.2em 1.2em 0.2em 0.8em;
  min-width: 320px;
  max-width: 480px;
  width: 100%;
  transition: box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), border 0.3s cubic-bezier(0.4,0,0.2,1);
  border: 2px solid transparent;
  position: relative;
}
.search-bar.focused {
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.13);
  border: 2px solid #0077cc;
}
.search-bar.empty {
  border: 2px solid #ffb3b3;
}
.search-icon {
  margin-right: 0.7em;
  flex-shrink: 0;
  transition: stroke 0.3s cubic-bezier(0.4,0,0.2,1);
}
.search-input {
  border: none;
  outline: none;
  font-size: 1.08rem;
  background: transparent;
  width: 100%;
  padding: 0.7em 0 0.7em 0;
  color: #222;
  transition: color 0.2s cubic-bezier(0.4,0,0.2,1);
}
.clear-btn {
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  margin-left: 0.5em;
  padding: 0.2em;
  border-radius: 50%;
  transition: background 0.2s cubic-bezier(0.4,0,0.2,1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.clear-btn:hover {
  background: #f3f3f3;
}
.no-results {
  text-align: center;
  color: #888;
  font-size: 1.1rem;
  margin: 2.5rem 0 1.5rem 0;
  animation: fadeInUp 0.5s cubic-bezier(0.4,0,0.2,1);
}
.no-results span {
  color: #0077cc;
  font-weight: 500;
}
.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 2.2rem 1.5rem;
  margin-bottom: 2.5rem;
  margin-top: 0.5rem;
}
.news-card-anim {
  animation: fadeInCard 0.5s cubic-bezier(0.4,0,0.2,1);
  will-change: transform, opacity;
}
@keyframes fadeInCard {
  from { opacity: 0; transform: translateY(18px);}
  to { opacity: 1; transform: translateY(0);}
}
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
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 2px 12px 0 rgba(0,119,204,0.07);
  transition: background 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);
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
