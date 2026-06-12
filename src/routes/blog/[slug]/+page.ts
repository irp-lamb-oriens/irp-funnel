import { error } from '@sveltejs/kit';

export interface BlogArticle {
  slug: string;
  title: string;
  bodyHtml: string;
  author: string;
  updatedAt: string;
  createdAt: string;
}

/**
 * Resolve the backend API base for both SSR (Netlify function) and the
 * browser. We derive it from the page URL so it works in every environment
 * without relying on `window`.
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
  params: { slug: string };
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<{ article: BlogArticle }> {
  const base = apiBase(url.hostname);
  const res = await fetch(`${base}/api/blog/${encodeURIComponent(params.slug)}`);

  if (res.status === 404) {
    throw error(404, 'This guide could not be found.');
  }
  if (!res.ok) {
    throw error(res.status, 'Failed to load this guide.');
  }

  const article = (await res.json()) as BlogArticle;
  return { article };
}
