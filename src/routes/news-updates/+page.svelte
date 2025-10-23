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

  const LIMIT = 9;
  let blogs: any[] = [];
  let total = 0;
  let cosmicTotal = 0;
  let renderTotal = 0;
  let loading = true;
  let initialLoadComplete = false;

  const cosmicCache = new Map<number, any[]>();
  const renderCache = new Map<number, any>();

  let search = "";
  let searchFocused = false;
  let searchTouched = false;
  let isStreaming = false;
  let noResults = false;
  let searchTimeout: ReturnType<typeof setTimeout>;

  $: isSearching = search.length > 0;
  $: showPagination = !isSearching;

  const RENDER_API_URL = "https://ai-newsletter-translated.onrender.com";
  const RENDER_API_HOLDER = "consultation%40internationalrelocationpartner.com";

  function processRenderArticle(article: any) {
    const titleMatch = article.content ? article.content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) : null;
    const title = titleMatch ? titleMatch[1] : "Article";
    const content = article.content ? article.content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "") : "";
    const imageMatch = content.match(/<img[^>]+src="([^">]+)"/);
    const imageUrl = imageMatch ? imageMatch[1] : "";

    return {
      slug: article.id,
      title: title,
      metadata: {
        title: content,
        poster: { imgix_url: imageUrl, url: imageUrl },
      },
      type: "blogs",
      source: "render"
    };
  }

  async function fetchCosmicPage(pageToFetch: number): Promise<any[]> {
    if (cosmicCache.has(pageToFetch)) {
      return cosmicCache.get(pageToFetch)!;
    }
    const skip = LIMIT * pageToFetch;
    const query = encodeURIComponent(JSON.stringify({ type: "blogs" }));
    const cosmicApiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=${query}&limit=${LIMIT}&skip=${skip}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
    const cosmicRes = await fetch(cosmicApiUrl);
    const cosmicData = await cosmicRes.json();
    const cosmicBlogs = cosmicData.objects || [];
    cosmicCache.set(pageToFetch, cosmicBlogs);
    return cosmicBlogs;
  }

  async function fetchRenderPage(pageToFetch: number) {
    if (renderCache.has(pageToFetch)) {
      return renderCache.get(pageToFetch);
    }
    const pageParams = new URLSearchParams();
    pageParams.set("page", (pageToFetch + 1).toString());
    pageParams.set("lang", "en");
    const url = `${RENDER_API_URL}/articles/${RENDER_API_HOLDER}?${pageParams.toString()}&size=${LIMIT}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed for Render page ${pageToFetch}`);
    const data = await resp.json();
    const articlesData = data.articles["en"] || { withImages: [], withoutImages: [], total: 0 };
    renderCache.set(pageToFetch, articlesData);
    return articlesData;
  }

  async function loadAndDisplayPage(page: number) {
    if (isSearching) return;
    loading = true;
    try {
      const cosmicPages = Math.ceil(cosmicTotal / LIMIT);
      let pageData = [];

      if (page < cosmicPages - 1) {
        pageData = await fetchCosmicPage(page);
      } else if (page === cosmicPages - 1) {
        const cosmicBlogs = await fetchCosmicPage(page);
        const remainingSpace = LIMIT - cosmicBlogs.length;
        if (remainingSpace > 0) {
          const renderData = await fetchRenderPage(0);
          const renderBlogs = [...renderData.withImages, ...renderData.withoutImages]
            .map(processRenderArticle)
            .slice(0, remainingSpace);
          pageData = [...cosmicBlogs, ...renderBlogs];
        } else {
          pageData = cosmicBlogs;
        }
      } else {
        const renderPageIndex = page - cosmicPages;
        const renderData = await fetchRenderPage(renderPageIndex);
        const renderBlogs = [...renderData.withImages, ...renderData.withoutImages].map(processRenderArticle);
        pageData = renderBlogs;
      }
      blogs = pageData;

      // Prefetching logic
      const totalPages = Math.ceil(total / LIMIT);
      if (page > 0) prefetchPage(page - 1);
      if (page < totalPages - 1) prefetchPage(page + 1);

    } catch (err) {
      console.error("Error fetching article list.", err);
    } finally {
      loading = false;
    }
  }
  
  async function initialLoad() {
    loading = true;
    try {
      const query = encodeURIComponent(JSON.stringify({ type: "blogs" }));
      const cosmicApiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=${query}&limit=${LIMIT}&skip=0&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
      const cosmicRes = await fetch(cosmicApiUrl);
      const cosmicData = await cosmicRes.json();
      cosmicTotal = cosmicData.total || 0;
      const firstPageBlogs = cosmicData.objects || [];
      blogs = firstPageBlogs;
      cosmicCache.set(0, firstPageBlogs);
    } catch (e) {
      console.error("Error during initial load", e);
    } finally {
      loading = false;
      initialLoadComplete = true;
      fetchSecondaryTotal();
    }
  }

  async function fetchSecondaryTotal() {
    try {
      const renderData = await fetchRenderPage(0);
      renderTotal = renderData.total;
      total = cosmicTotal + renderTotal;
    } catch (e) {
      console.error("Error fetching secondary total", e);
    }
  }

  async function prefetchPage(page: number) {
    try {
        const cosmicPages = Math.ceil(cosmicTotal / LIMIT);
        if (page < cosmicPages) {
            fetchCosmicPage(page).catch(e => {});
        } else {
            const renderPageIndex = page - cosmicPages;
            fetchRenderPage(renderPageIndex).catch(e => {});
        }
    } catch(e) {}
  }

  async function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (!search) {
        noResults = false;
        loadAndDisplayPage(pageIndex);
        return;
      }

      isStreaming = true;
      blogs = [];
      total = 0;
      noResults = false;

      try {
        // Fetch from CosmicJS first to ensure it's at the top of the list
        const cosmicQuery = encodeURIComponent(JSON.stringify({
          type: "blogs",
          title: { "$regex": search, "$options": "i" }
        }));
        const cosmicSearchPromise = fetch(`https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=${cosmicQuery}&limit=${LIMIT}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`)
          .then(res => res.json())
          .then(data => (data.objects || []));

        const cosmicResults = await cosmicSearchPromise;
        blogs = cosmicResults;
        total = cosmicResults.length;

        // Now, stream results from the Render API and append them
        const searchUrl = `${RENDER_API_URL}/articles/${RENDER_API_HOLDER}?search=${search}`;
        const resp = await fetch(searchUrl);
        if (resp.ok) {
            const reader = resp.body?.getReader();
            if (!reader) return;
            
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    if (line.trim() === "") continue;
                    const article = JSON.parse(line);
                    blogs = [...blogs, processRenderArticle(article)];
                    total++;
                }
            }
        }

        if (total === 0) {
          noResults = true;
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        isStreaming = false;
      }
    }, 500);
  }

  onMount(() => {
    initialLoad();
  });

  $: if (browser && initialLoadComplete) {
    loadAndDisplayPage(pageIndex);
  }

  function getExcerpt(html: string, maxLength = 180) {
    if (typeof document === "undefined" || !html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    if (text.length <= maxLength) return text;
    const cut = text.lastIndexOf(" ", maxLength);
    return text.slice(0, cut > 0 ? cut : maxLength) + "...";
  }

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
    }, 420);
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
          on:keyup={handleSearch}
          class="search-input"
          autocomplete="off"
        />
        {#if search}
          <button class="clear-btn" on:click={() => { search = ""; handleSearch(); }} aria-label="Clear search">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="4" y1="4" x2="14" y2="14" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>
              <line x1="14" y1="4" x2="4" y2="14" stroke="#bbb" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
    {#if loading || isStreaming}
      <div class="loading">{#if isStreaming} Searching... {:else} Loading... {/if}</div>
    {:else}
      {#if isSearching && noResults}
        <div class="no-results">No news found for "<span>{search}</span>"</div>
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
          <span>Page {pageIndex + 1} of {Math.ceil(total / LIMIT) || 1}</span>
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
        {#each blogs as blog (blog.slug)}
          <div class="news-card-anim">
            <NewsCard
              imageSrc={blog.metadata?.poster?.imgix_url || blog.metadata?.poster?.url || ""}
              imageAlt={blog.title}
              title={blog.title}
              excerpt={getExcerpt(blog.metadata?.title)}
              link={`/news-updates/blog?slug=${blog.slug}&page=${pageIndex}${blog.source === 'render' ? '&type=render' : ''}`}
              readMoreText="read more"
            />
          </div>
        {/each}
      </div>
      {#if showPagination && total > LIMIT}
        <div class="pagination">
          <button
            class="pagination-btn newer {animating === "newer" ? "animating" : ""}"
            on:click={() => handlePaginate("newer")}
            disabled={pageIndex === 0 || !!animating}
          >
            &laquo; Newer Entries
          </button>
          <span>Page {pageIndex + 1} of {Math.ceil(total / LIMIT) || 1}</span>
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
