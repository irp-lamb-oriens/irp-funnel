<script lang="ts">
  import CtaButton from './Header/CTAButton.svelte';
  import NewsCard from './NewsCard.svelte';
  import { onMount } from 'svelte';

  let blogs: any[] = [];
  let loading = true;

  // Fetch latest 3 blogs from CosmicJS API
  async function fetchLatestBlogs() {
    loading = true;
    const apiUrl = 'https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22type%22:%22blogs%22%7D&limit=3&skip=0&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type';
    const res = await fetch(apiUrl);
    const data = await res.json();
    blogs = data.objects || [];
    loading = false;
  }

  function getExcerpt(html: string, maxLength = 140) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    if (text.length <= maxLength) return text;
    const cut = text.lastIndexOf(' ', maxLength);
    return text.slice(0, cut > 0 ? cut : maxLength) + '...';
  }

  onMount(fetchLatestBlogs);
</script>

<section class="latest-news">
  <div class="row">
    <div class="col">
      <h2 class="latest-news-title">Latest News</h2>
      <div class="news-grid">
        {#if loading}
          <div>Loading...</div>
        {:else}
          {#each blogs as blog (blog.slug)}
            <NewsCard
              imageSrc={blog.metadata?.poster?.imgix_url || blog.metadata?.poster?.url || ''}
              imageAlt={blog.title}
              title={blog.title}
              excerpt={getExcerpt(blog.metadata?.title)}
              link={`/news-updates/blog?slug=${blog.slug}&page=0`}
              readMoreText="READ MORE"
            />
          {/each}
        {/if}
      </div>
      <div class="button-row">
        <CtaButton label="View All Blog" href="/news-updates" variant="primary" />
      </div>
    </div>
  </div>
</section>

<style lang="scss">
// Main section styling
.latest-news {
  background: #f7f8fa; // very light gray
  padding: 4rem 0 4rem 0;
  display: flex;
  justify-content: center;
  width: 100%;
}

.latest-news > .row {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
}

.latest-news > .row > .col {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  place-items: center;
}

// Title styling
.latest-news-title {
  color: var(--color-highlight-1);
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 10rem;

  @media (max-width: 1024px) {
    margin-bottom: 5rem;
  }
}

// Responsive grid container
.news-grid {
  display: grid;
  place-items: center;
  justify-content: center;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem; // 32px gutters
  margin-bottom: 6rem;
  align-items: start;
  height: 420px;
  min-height: 420px;
  position: relative;
}



// News item link (wraps text)
.news-item-link {
  display: block;
  width: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

// News item image
.news-item-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 50%;
  display: block;
  border-radius: 14px 14px 0 0;
  transition:
    transform 0.95s cubic-bezier(.22,-.61,.36,1),
    object-position 0.95s cubic-bezier(.22,-.61,.36,1);
}

// News item title
.news-item-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-highlight-1);
  margin-bottom: 0.5rem;
  transition:
    transform 0.45s cubic-bezier(0.77,0,0.175,1),
    color 0.45s cubic-bezier(0.77,0,0.175,1);
}
// News item texts wrapper for staggered transitions
.news-item-texts {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  width: 100%;
  align-items: flex-start;
  justify-content: flex-end;
  min-height: 120px;
  transition: max-height 1.1s cubic-bezier(.22,-.61,.36,1);
  will-change: transform, opacity, max-height;
}

// News item title
.news-item-title {
  font-size: 1.18rem;
  font-weight: 800;
  color: var(--color-highlight-1);
  margin-bottom: 0.3rem;
  line-height: 1.25;
  max-height: 2.7em;
  overflow: hidden;
  text-align: left;
  transition:
    transform 0.95s cubic-bezier(.22,-.61,.36,1) 0.04s,
    opacity 0.95s cubic-bezier(.22,-.61,.36,1) 0.04s;
  will-change: transform, opacity;
}

// News item description
.news-item-desc {
  font-size: 1.01rem;
  color: #7a7a7a;
  margin-bottom: 0.4rem;
  line-height: 1.5;
  max-height: 6.2em;
  overflow: hidden;
  text-align: left;
  opacity: 0.92;
  transition:
    transform 1.1s cubic-bezier(.22,-.61,.36,1) 0.09s,
    opacity 1.1s cubic-bezier(.22,-.61,.36,1) 0.09s;
  will-change: transform, opacity;
}

// "Read more" link
.more-link {
  color: var(--color-highlight-1);
  font-weight: 700;
  text-decoration: none;
  font-size: 0.93rem;
  letter-spacing: 0.04em;
  margin-top: 0.2em;
  display: inline-block;
  align-self: flex-start;
  text-align: left;
  opacity: 0.88;
  transition:
    transform 1.25s cubic-bezier(.22,-.61,.36,1) 0.13s,
    opacity 1.25s cubic-bezier(.22,-.61,.36,1) 0.13s;
  will-change: transform, opacity;
  cursor: pointer;
}

// Button row
.button-row {
  display: flex;
  gap: 1rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}

// Secondary button
.secondary-btn {
  background: #fff;
  color: var(--color-highlight-1);
  border: 2px solid var(--color-highlight-1);
  display: inline-block;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  &:hover {
    background: #e6f2ff;
  }
}

// Responsive grid system adjustments
.row {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}
.col {
  flex: 1 1 100%;
  min-width: 0;
}

// Responsive breakpoints
@media (max-width: 1100px) {
  .news-grid {
    gap: 1.5rem;
    height: 700px;
    min-height: 700px;
    align-items: start;
  }
}
@media (max-width: 700px) {
  .latest-news {
    padding: 1.2rem 0;
  }
  .news-grid {
    grid-template-columns: 1fr;
    gap: 1.1rem;
    height: 1200px;
    min-height: 1200px;
    align-items: start;
  }
  .news-item-card {
    padding: 1.1rem 0.7rem 0.8rem 0.7rem;
    margin-top: -1.2rem;
  }
  .latest-news-title {
    font-size: 1.3rem !important;
  }
}
</style>
