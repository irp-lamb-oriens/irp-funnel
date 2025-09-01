<script lang="ts">
  import Header from '../../../components/Header/Header.svelte';
  import Footer from '../../../components/Footer/Footer.svelte';
  import CountryLayout from '../../../components/ui/CountryLayout.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
    import CountryContentWrapper from '../../../components/ui/CountryContentWrapper.svelte';

  let slug = '';
  let pageIndex = 0;
  let blog: any = null;
  let loading = true;

  $: {
    const url = $page.url;
    slug = url.searchParams.get('slug') || '';
    pageIndex = parseInt(url.searchParams.get('page') || '0');
  }

  async function fetchBlog() {
    if (!slug) return;
    loading = true;
    const apiUrl = `https://api.cosmicjs.com/v3/buckets/funnel-irp-production/objects?pretty=true&query=%7B%22slug%22:%22${slug}%22%7D&read_key=M0RpfpaHXuCGwLPMvDLrJukQRNA1MujReoOjIud8NP7EYGsV0c&depth=1&props=slug,title,metadata,type`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    blog = data.objects && data.objects.length > 0 ? data.objects[0] : null;
    loading = false;
  }

  $: $page, fetchBlog();
</script>

<Header />

<CountryLayout heroTitle={blog ? blog.title : 'Blog'} heroUrl={blog?.metadata?.poster?.imgix_url || blog?.metadata?.poster?.url || 'https://images.pexels.com/photos/10464468/pexels-photo-10464468.jpeg?w=2000'}>
  <CountryContentWrapper>
    <section class="blog-detail">
      {#if loading}
        <div class="loading">Loading...</div>
      {:else if blog}
        <div class="blog-header">
          <h1>{blog.title}</h1>
        </div>
        <div class="blog-content">{@html blog.metadata?.title || ''}</div>
        <div style="margin-top:2rem;">
          <a href={`/news-updates?page=${pageIndex}`} class="back-link">← Back to News</a>
        </div>
      {:else}
        <div class="error">Blog not found.</div>
      {/if}
    </section>
  </CountryContentWrapper>
</CountryLayout>

<Footer />

<style>
.blog-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.blog-header h1 {
  margin-bottom: 1rem;
}
.blog-content {
  font-size: 1.1rem;
  line-height: 1.7;
}
.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  color: #0077cc;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
</style>
