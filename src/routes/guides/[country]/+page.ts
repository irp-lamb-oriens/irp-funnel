import { error } from '@sveltejs/kit';
import countries from '../../../components/systems/inputs/Country/countries.ts';

export interface GuidePageData {
  country: string;
  displayName: string;
  title: string;
  bodyHtml: string;
  pdfUrl: string;
  markdownContent: string;
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
  params,
  fetch,
  url,
}: {
  params: { country: string };
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<GuidePageData> {
  const { country } = params;

  // 1. CRM source of truth — a published country-guide post (editable in the
  //    dashboard Posts view). Resolved by slug or country name on the server.
  try {
    const res = await fetch(`${apiBase(url.hostname)}/api/guides/${encodeURIComponent(country)}`);
    if (res.ok) {
      const guide = (await res.json()) as {
        country?: string;
        title?: string;
        bodyHtml?: string;
        pdfUrl?: string;
      };
      // Only use the CRM guide when it carries authored HTML. An IAM-only
      // fallback (pdfUrl but no body) falls through to the bundled markdown
      // so the page still renders rich content.
      if (guide.bodyHtml && guide.bodyHtml.trim()) {
        return {
          country,
          displayName: guide.country || '',
          title: guide.title || '',
          bodyHtml: guide.bodyHtml,
          pdfUrl: guide.pdfUrl || '',
          markdownContent: '',
        };
      }
    }
  } catch {
    // Backend unavailable — fall back to the bundled markdown guide.
  }

  // 2. Fallback: bundled markdown guide shipped with the app.
  //    .md files live in src/lib/data/country-guides.
  const modules = import.meta.glob('../../../lib/data/country-guides/*.md', {
    query: '?raw',
    import: 'default',
  });

  const expectedPath = `../../../lib/data/country-guides/${country}.md`;
  const alternativePath = `../../../lib/data/country-guides/${
    countries.find((c) => c.code === country.toUpperCase())?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || country
  }.md`;

  if (!modules[expectedPath] && !modules[alternativePath]) {
    throw error(404, `Guide for country "${country}" not found.`);
  }

  const markdownContent = (await (modules[expectedPath] || modules[alternativePath])()) as string;

  return {
    country,
    displayName: '',
    title: '',
    bodyHtml: '',
    pdfUrl: '',
    markdownContent,
  };
}
