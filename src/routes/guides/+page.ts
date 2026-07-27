interface GuideEntry {
  slug: string;
  name: string;
}

/**
 * Backend API base — derived from the page URL so it resolves in SSR and the
 * browser without relying on `window`. Mirrors blog/[slug]/+page.ts.
 */
function apiBase(hostname: string): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return 'https://irp-funnel-server.onrender.com';
}

export async function load({
  fetch,
  url,
}: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<{ guides: GuideEntry[] }> {
  // Bundled markdown guides — permanent baseline so the index is never empty,
  // even if the backend is unreachable or a country hasn't been seeded yet.
  // .md files live in src/lib/data/country-guides.
  const modules = import.meta.glob('../../lib/data/country-guides/*.md', {
    query: '?raw',
    import: 'default',
  });

  const bySlug = new Map<string, GuideEntry>();
  for (const path of Object.keys(modules)) {
    const slug = path.split('/').pop()?.replace('.md', '') || '';
    if (!slug) continue;
    const name = slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    bySlug.set(slug, { slug, name });
  }

  // Published CRM country-guide posts are the editable source of truth and take
  // precedence over the bundled baseline (same slug overrides the entry).
  try {
    const res = await fetch(`${apiBase(url.hostname)}/api/guides`);
    if (res.ok) {
      const { guides = [] } = (await res.json()) as {
        guides: Array<{ slug: string; name?: string }>;
      };
      for (const g of guides) {
        if (g.slug) bySlug.set(g.slug, { slug: g.slug, name: g.name || g.slug });
      }
    }
  } catch {
    // Backend unavailable — fall back to the bundled list only.
  }

  const guides = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { guides };
}
