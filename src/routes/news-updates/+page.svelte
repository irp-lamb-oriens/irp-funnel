<script lang="ts">
  import Header from "../../components/Header/Header.svelte";
  import Footer from "../../components/Footer/Footer.svelte";
  import CountryLayout from "../../components/ui/CountryLayout.svelte";
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
  let streamingCount = 0;  // live hit count shown during streaming
  let noResults = false;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let pageIndexBeforeSearch = 0;
  let currentSearchAbort: AbortController | null = null;

  $: isSearching = search.length > 0;
  $: showPagination = !isSearching;

  const RENDER_API_URL = "https://ai-newsletter-translated.onrender.com";
  const RENDER_API_HOLDER = "consultation%40internationalrelocationpartner.com";

  function processRenderArticle(article: any) {
    // Handles both "full" paginated format (has `content`) and
    // "slim" search format (has `imageUrl` + `excerpt` instead of full HTML).
    const title = article.title || "Article";
    const imageUrl = article.imageUrl ||
      (article.content ? (article.content.match(/<img[^>]+src="([^">]+)"/) ?? [])[1] ?? "" : "");
    const excerpt = article.excerpt || article.content || "";

    return {
      slug: article.id,
      title: title,
      metadata: {
        title: excerpt,
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
    // 2 seconds debounce — prevents expensive searches on every keystroke
    searchTimeout = setTimeout(async () => {
      if (!search) {
        // Cancel any in-flight search
        if (currentSearchAbort) { currentSearchAbort.abort(); currentSearchAbort = null; }
        isStreaming = false;
        streamingCount = 0;
        noResults = false;
        total = cosmicTotal + renderTotal;
        loadAndDisplayPage(pageIndexBeforeSearch);
        if (pageIndex !== pageIndexBeforeSearch) goToPage(pageIndexBeforeSearch);
        return;
      }

      // Cancel any previous in-flight search immediately
      if (currentSearchAbort) currentSearchAbort.abort();
      const abortCtrl = new AbortController();
      currentSearchAbort = abortCtrl;

      if (!isStreaming) pageIndexBeforeSearch = pageIndex;
      isStreaming = true;
      streamingCount = 0;
      blogs = [];
      total = 0;
      noResults = false;

      try {
        // CosmicJS — fast title regex search
        const cosmicQuery = encodeURIComponent(JSON.stringify({
          type: "blogs",
          title: { "$regex": search, "$options": "i" }
        }));
        const cosmicResults = await fetch(
          `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=${cosmicQuery}&limit=${LIMIT}&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`,
          { signal: abortCtrl.signal }
        ).then(r => r.json()).then(d => d.objects || []);

        // Show cosmic results immediately (they arrive before streaming kicks in)
        blogs = cosmicResults;
        total = cosmicResults.length;
        streamingCount = total;

        // Stream Render API results — slim payloads, maxHits=50 to stop early
        const searchUrl = `${RENDER_API_URL}/articles/${RENDER_API_HOLDER}?search=${encodeURIComponent(search)}&lang=en&maxHits=50`;
        const resp = await fetch(searchUrl, { signal: abortCtrl.signal });
        if (resp.ok && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const article = JSON.parse(line);
                // Append each article immediately so the grid updates in real time
                blogs = [...blogs, processRenderArticle(article)];
                total++;
                streamingCount++;
              } catch { /* skip malformed line */ }
            }
          }
        }

        if (total === 0) noResults = true;
      } catch (err: any) {
        if (err?.name !== "AbortError") console.error("Search error:", err);
      } finally {
        if (currentSearchAbort === abortCtrl) {
          isStreaming = false;
          currentSearchAbort = null;
        }
      }
    }, 2000); // 2 second debounce
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

  // Presentation helpers (no data logic): imgix thumbnails at card size, and
  // the poster URL whichever field it arrives in.
  function posterOf(blog: any): string {
    return blog?.metadata?.poster?.imgix_url || blog?.metadata?.poster?.url || "";
  }
  function thumb(src: string, w = 900): string {
    if (!src || !/imgix\.net/.test(src)) return src;
    return `${src}${src.includes("?") ? "&" : "?"}w=${w}&auto=format,compress`;
  }
  $: totalPages = Math.ceil(total / LIMIT) || 1;

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

<CountryLayout
  heroTitle="News"
  heroEyebrow="News & guides"
  heroSubTitle="Rule changes, costs and practical advice for moving abroad."
  heroUrl="https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg?w=2000"
>
  <section class="news-list" aria-labelledby="news-list-title">
    <div class="news-toolbar">
      <h2 id="news-list-title" class="news-toolbar__title">
        {#if isSearching}Search results{:else}Latest articles{/if}
      </h2>
      <div class="search-bar-wrap" role="search">
        <div class="search-bar {searchFocused ? "focused" : ""}">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="2"/>
            <line x1="15.6" y1="15.6" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <label class="sr-only" for="news-search">Search news and guides</label>
          <input
            id="news-search"
            type="search"
            placeholder="Search articles"
            bind:value={search}
            on:focus={() => { searchFocused = true; searchTouched = true; }}
            on:blur={() => { searchFocused = false; }}
            on:keyup={handleSearch}
            class="search-input"
            autocomplete="off"
          />
          {#if search}
            <button type="button" class="clear-btn" on:click={() => { search = ""; handleSearch(); }} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <line x1="4" y1="4" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="14" y1="4" x2="4" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>

    <p class="news-status" aria-live="polite">
      {#if isStreaming}
        <span class="news-status__pulse" aria-hidden="true"></span>
        Searching{#if streamingCount > 0}<span class="stream-count">{streamingCount} found so far</span>{/if}
      {:else if isSearching && noResults}
        No articles match “<span class="news-status__q">{search}</span>”. Try a country or a topic, like “customs” or “visa”.
      {:else if isSearching && total > 0}
        {total} {total === 1 ? "article" : "articles"} for “<span class="news-status__q">{search}</span>”
      {/if}
    </p>

    {#if loading}
      <div class="news-grid" aria-busy="true" aria-label="Loading articles">
        {#each Array(6) as _, i}
          <div class="news-card news-card--skeleton" class:featured={i === 0 && pageIndex === 0} aria-hidden="true">
            <div class="news-card__media"></div>
            <div class="news-card__body">
              <span class="sk sk--title"></span>
              <span class="sk"></span>
              <span class="sk sk--short"></span>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <ul class="news-grid" role="list">
        {#each blogs as blog, i (blog.slug)}
          {@const poster = posterOf(blog)}
          {@const featured = i === 0 && pageIndex === 0 && !isSearching}
          <li class="news-card-anim" class:featured style="--d:{Math.min(i, 8) * 45}ms">
            <a
              class="news-card"
              class:news-card--text={!poster}
              href={`/news-updates/blog?slug=${blog.slug}&page=${pageIndex}${blog.source === 'render' ? '&type=render' : ''}`}
            >
              {#if poster}
                <div class="news-card__media">
                  <img
                    src={thumb(poster, featured ? 1400 : 900)}
                    alt=""
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              {/if}
              <div class="news-card__body">
                {#if featured}<span class="news-card__tag">Latest</span>{/if}
                <h3 class="news-card__title">{blog.title}</h3>
                <p class="news-card__excerpt">{getExcerpt(blog.metadata?.title, featured ? 260 : 160)}</p>
                <span class="news-card__more" aria-hidden="true">
                  Read article
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </div>
            </a>
          </li>
        {/each}
      </ul>

      {#if showPagination && total > LIMIT}
        <nav class="pagination" aria-label="Article pages">
          <button
            type="button"
            class="pagination-btn newer {animating === "newer" ? "animating" : ""}"
            on:click={() => handlePaginate("newer")}
            disabled={pageIndex === 0 || !!animating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            Newer
          </button>
          <span class="pagination__count">Page <b>{pageIndex + 1}</b> of {totalPages}</span>
          <button
            type="button"
            class="pagination-btn older {animating === "older" ? "animating" : ""}"
            on:click={() => handlePaginate("older")}
            disabled={(LIMIT * (pageIndex + 1)) >= total || !!animating}
          >
            Older
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </nav>
      {/if}
    {/if}
  </section>
</CountryLayout>

<Footer />
